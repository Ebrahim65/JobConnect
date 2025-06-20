from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, HTMLResponse
from ..utils.auth import get_current_user
from ..models.income import TechnicianIncomeOut
from ..database import get_db
from ..models.payment import PaymentStatus
import asyncpg
from datetime import datetime, timedelta
from typing import Optional, List
import io
import csv
from xhtml2pdf import pisa
from io import BytesIO
from jinja2 import Template

income_router = APIRouter(prefix="/income", tags=["Income Analytics"])

# Template for PDF generation
PDF_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Income Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #3182ce; }
        .header { display: flex; justify-content: space-between; }
        .summary { margin: 20px 0; }
        .summary-card { 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 8px; 
            margin-bottom: 10px;
        }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .badge {
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        .completed { background-color: #c6f6d5; color: #22543d; }
        .pending { background-color: #feebc8; color: #7b341e; }
        .failed { background-color: #fed7d7; color: #742a2a; }
        .refunded { background-color: #bee3f8; color: #2a4365; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Income Report</h1>
        <div>
            <p><strong>Generated:</strong> {{ generated_date }}</p>
            {% if start_date or end_date %}
            <p><strong>Period:</strong> 
                {{ start_date if start_date else 'Beginning' }} 
                to {{ end_date if end_date else 'Now' }}
            </p>
            {% endif %}
        </div>
    </div>
    
    <div class="summary">
        <h2>Summary</h2>
        <div class="summary-card">
            <p><strong>Total Income:</strong> {{ total_income }}</p>
            <p><strong>Completed Payments:</strong> {{ completed_income }} ({{ completed_payments }} payments)</p>
            <p><strong>Pending Payments:</strong> {{ pending_income }} ({{ pending_payments }} payments)</p>
            <p><strong>Failed Payments:</strong> {{ failed_income }} ({{ failed_payments }} payments)</p>
            <p><strong>Refunded:</strong> {{ refunded_income }}</p>
        </div>
    </div>
    
    <h2>Transaction History</h2>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Job ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Method</th>
            </tr>
        </thead>
        <tbody>
            {% for transaction in transactions %}
            <tr>
                <td>{{ transaction.payment_date }}</td>
                <td>{{ transaction.job_id[:8] }}</td>
                <td>{{ transaction.amount }}</td>
                <td>
                    <span class="badge {{ transaction.status }}">
                        {{ transaction.status }}
                    </span>
                </td>
                <td>{{ transaction.payment_type }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</body>
</html>
"""

@income_router.get("/me")
async def get_technician_income(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")

    # Query using your existing view
    row = await conn.fetchrow(
        """
        SELECT * FROM technician_income
        WHERE technician_id = $1
        """, 
        current_user["id"]
    )

    if not row:
        # Return zero values if no payments exist
        return {
            "technician_id": current_user["id"],
            "technician_name": "",
            "total_income": 0,
            "total_payments": 0,
            "completed_income": 0,
            "pending_income": 0,
            "failed_income": 0,
            "refunded_income": 0,
            "first_payment_date": None,
            "last_payment_date": None,
            "completed_payments": 0,
            "pending_payments": 0,
            "failed_payments": 0,
            "refunded_payments": 0
        }

    return dict(row)


@income_router.get("/earnings-over-time")
async def get_earnings_over_time(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")

    base_query = """
        SELECT 
            DATE(transaction_date) as date,
            COALESCE(SUM(amount), 0) as amount
        FROM payment
        WHERE technician_id = $1
        AND payment_status = 'completed'
    """
    
    params = [current_user["id"]]
    conditions = []
    
    if start_date:
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            conditions.append("transaction_date >= $" + str(len(params) + 1))
            params.append(start_date_obj)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
            
    if end_date:
        try:
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
            conditions.append("transaction_date <= $" + str(len(params) + 1))
            params.append(datetime.combine(end_date_obj, datetime.max.time()))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    if conditions:
        base_query += " AND " + " AND ".join(conditions)
    
    base_query += " GROUP BY DATE(transaction_date) ORDER BY DATE(transaction_date)"
    
    try:
        earnings_data = await conn.fetch(base_query, *params)
        
        if earnings_data:
            start = start_date_obj if start_date else earnings_data[0]['date']
            end = end_date_obj if end_date else earnings_data[-1]['date']
            
            date_range = []
            current_date = start
            while current_date <= end:
                date_range.append(current_date)
                current_date += timedelta(days=1)
            
            earnings_map = {row['date']: row['amount'] for row in earnings_data}
            filled_data = [
                {"date": date.strftime("%Y-%m-%d"), 
                 "amount": float(earnings_map.get(date, 0))}
                for date in date_range
            ]
            
            return filled_data
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@income_router.get("/transactions")
async def get_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")
    
    base_query = """
        SELECT 
            p.payment_id,
            p.booking_id as job_id,
            c.name as client_name,
            p.amount,
            p.payment_status as status,
            p.payment_method as payment_type,
            p.transaction_date as payment_date
        FROM payment p
        JOIN client c ON p.client_id = c.client_id
        WHERE p.technician_id = $1
    """
    
    params = [current_user["id"]]
    conditions = []
    
    if start_date:
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            conditions.append("p.transaction_date >= $" + str(len(params) + 1))
            params.append(start_date_obj)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
            
    if end_date:
        try:
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
            conditions.append("p.transaction_date <= $" + str(len(params) + 1))
            params.append(datetime.combine(end_date_obj, datetime.max.time()))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    if conditions:
        base_query += " AND " + " AND ".join(conditions)
    
    offset = (page - 1) * per_page
    transactions = await conn.fetch(
        base_query + f" ORDER BY p.transaction_date DESC LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}",
        *params, per_page, offset
    )
    
    count_query = "SELECT COUNT(*) FROM (" + base_query + ") as subquery"
    total = await conn.fetchval(count_query, *params)
    
    return {
        "transactions": transactions,
        "total_transactions": total
    }

@income_router.get("/export/csv")
async def export_income_csv(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")
    
    # Get income summary
    income_data = await get_technician_income(current_user, conn)
    
    # Get transactions
    transactions_data = await get_transactions(
        1,  # First page
        10000,  # Large number to get all transactions
        start_date,
        end_date,
        current_user,
        conn
    )
    
    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "Income Report",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Period: {start_date or 'Beginning'} to {end_date or 'Now'}"
    ])
    writer.writerow([])  # Empty row
    
    # Write summary
    writer.writerow(["Summary"])
    writer.writerow(["Total Income:", income_data["total_income"]])
    writer.writerow(["Completed Payments:", income_data["completed_income"], f"({income_data.get('completed_payments', 0)} payments)"])
    writer.writerow(["Pending Payments:", income_data["pending_income"], f"({income_data.get('pending_payments', 0)} payments)"])
    writer.writerow(["Failed Payments:", income_data["failed_income"], f"({income_data.get('failed_payments', 0)} payments)"])
    writer.writerow(["Refunded:", income_data["refunded_income"]])
    writer.writerow([])  # Empty row
    
    # Write transactions header
    writer.writerow(["Transaction History"])
    writer.writerow(["Date", "Job ID", "Client", "Amount", "Status", "Payment Method"])
    
    # Write transactions
    for t in transactions_data["transactions"]:
        writer.writerow([
            t["payment_date"].strftime("%Y-%m-%d"),
            t["job_id"],
            t["client_name"],
            t["amount"],
            t["status"],
            t["payment_type"]
        ])
    
    # Prepare response
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=income_report_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )

@income_router.get("/export/pdf")
async def export_income_pdf(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")
    
    # Get income summary
    income_data = await get_technician_income(current_user, conn)
    
    # Get transactions
    transactions_data = await get_transactions(
        1,  # First page
        100,  # Limit for PDF
        start_date,
        end_date,
        current_user,
        conn
    )
    
    # Prepare template context
    context = {
        "generated_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "start_date": start_date,
        "end_date": end_date,
        "total_income": format_currency(income_data["total_income"]),
        "completed_income": format_currency(income_data["completed_income"]),
        "completed_payments": income_data.get("completed_payments", 0),
        "pending_income": format_currency(income_data["pending_income"]),
        "pending_payments": income_data.get("pending_payments", 0),
        "failed_income": format_currency(income_data["failed_income"]),
        "failed_payments": income_data.get("failed_payments", 0),
        "refunded_income": format_currency(income_data["refunded_income"]),
        "transactions": [
            {
                "payment_date": t["payment_date"].strftime("%Y-%m-%d"),
                "job_id": t["job_id"],
                "amount": format_currency(t["amount"]),
                "status": t["status"],
                "payment_type": t["payment_type"]
            }
            for t in transactions_data["transactions"]
        ]
    }
    
    # Render HTML
    template = Template(PDF_TEMPLATE)
    html = template.render(context)
    
    # Generate PDF using xhtml2pdf
    pdf = BytesIO()
    pisa.CreatePDF(html, dest=pdf)
    
    # Return PDF
    pdf.seek(0)
    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=income_report_{datetime.now().strftime('%Y%m%d')}.pdf"
        }
    )

def format_currency(amount: float) -> str:
    return f"R{amount:,.2f}"