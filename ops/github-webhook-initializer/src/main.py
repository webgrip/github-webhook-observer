import os
import requests
import json
import time

# Replace with your GitHub organization name
GITHUB_ORG = os.getenv('GITHUB_ORG')
# Replace with your personal access token
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
# Replace with your ngrok public URL
NGROK_PUBLIC_URL = os.getenv('NGROK_PUBLIC_URL')
# Replace with your tunnel name
NGROK_TUNNEL_NAME = os.getenv('NGROK_TUNNEL_NAME')

# Get ngrok public URL
def get_ngrok_url():
    url = f'{NGROK_PUBLIC_URL}/api/tunnels'
    print("Waiting for ngrok to start...")
    while True:
        try:
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                for tunnel in data['tunnels']:
                    print(f"Found tunnel: {tunnel['name']}")
                    if tunnel['name'] == f'{NGROK_TUNNEL_NAME}':
                        return tunnel['public_url']
        except Exception as e:
            print(f"Waiting for ngrok to start: {e}")
        time.sleep(5)

# Create the GitHub webhook
def add_org_webhook(org, token, webhook_url):
    url = f"https://api.github.com/orgs/{org}/hooks"
    headers = {
        "Authorization": f"token {token}",
        "Content-Type": "application/json"
    }
    data = {
        "name": "web",
        "active": True,
        "events": [
            "workflow_run",
            "workflow_job",
            "check_run",
            "push",
            "pull_request",
            "pull_request_review",
            "pull_request_review_comment",
            "issues",
            "issue_comment"
        ],
        "config": {
            "url": webhook_url,
            "content_type": "json"
        }
    }
    response = requests.post(url, headers=headers, data=json.dumps(data))
    if response.status_code in [200, 201]:
        print(f"Successfully added webhook to organization {org}")
    else:
        print(f"Failed to add webhook to organization {org}: {response.status_code} {response.text}")

if __name__ == "__main__":
    public_url = get_ngrok_url()
    print(f"ngrok public URL: {public_url}/webhook")
    add_org_webhook(GITHUB_ORG, GITHUB_TOKEN, f"{public_url}/webhook")
