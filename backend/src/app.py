from flask import Flask, jsonify, request, render_template
import requests
from flask_cors import CORS
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv
import os
from pinecone import Pinecone
import openai
from prompt_template import prompt

load_dotenv()

app = Flask(__name__)
CORS(app,
     origins=["http://localhost:3000"])

pc =Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index_name = pc.Index("ai-repectionist")

def get_embedding(text):
    response = openai.embeddings.create(
        input=text,
        model="text-embedding-ada-002"
    )
    return response.data[0].embedding

def search_pinecone(query):
    query_vector = get_embedding(query)
    results = index_name.query(vector=query_vector, top_k=3, include_metadata=True)
    return results

@app.route('/')
def index():
    return render_template('call.html')

@app.route('/session', methods=['GET'])
def get_session():
    try:
        user_query = request.args.get("query", "default query")
        pinecone_results = search_pinecone(user_query)
        retrieved_texts = [match["metadata"]["text"] for match in pinecone_results.get("matches", []) if "metadata" in match]     
        url = "https://api.openai.com/v1/realtime/sessions"
        
        payload = {
            "model": "gpt-4o-realtime-preview-2024-12-17",
            "modalities": ["audio", "text"],
            "instructions": prompt
        }
        
        headers = {
            'Authorization': 'Bearer ' + os.getenv('OPENAI_API_KEY'),
            'Content-Type': 'application/json'
        }

        response = requests.post(url, json=payload, headers=headers)
        return response.json()

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)