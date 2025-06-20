import os
import requests
from dotenv import load_dotenv

load_dotenv()

MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")
MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
MAILGUN_FROM = os.getenv("MAILGUN_FROM")

def send_email(to_email: str, subject: str, body: str):
    try:
        response = requests.post(
            f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages",
            auth=("api", MAILGUN_API_KEY),
            data={
                "from": MAILGUN_FROM,
                "to": [to_email],
                "subject": subject,
                "text": body,
            },
        )
        response.raise_for_status()
        print(f"[Email Sent] to {to_email}")
    except requests.exceptions.RequestException as e:
        print(f"[Mailgun Email Error] {e}")
