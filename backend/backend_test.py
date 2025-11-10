import requests

url = "http://127.0.0.1:5000/api/generate"
data = {"prompt": "Write a short motivational quote about learning AI."}

response = requests.post(url, json=data)
print(response.json())
