import os
import json
from flask import Flask, request, Response, stream_with_context, jsonify
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app) # Allow CORS for Vite frontend

# Initialize Groq client
api_key = os.environ.get("VITE_GROQ_API_KEY") # We'll reuse the same key for simplicity
client = Groq(api_key=api_key)

import redis

# Mock/Real Redis Context Manager
class ChatMemory:
    def __init__(self):
        # Prefer Upstash/Real Redis if URL is provided
        url = os.environ.get("UPSTASH_REDIS_URL")
        self.redis = None
        self.local_storage = {} 
        
        if url:
            try:
                # Use socket_timeout to avoid hanging indefinitely
                self.redis = redis.from_url(url, decode_responses=True, socket_timeout=5)
                # Test connection immediately
                self.redis.ping()
                print("Connected to Upstash Redis.")
            except Exception as e:
                print(f"Redis connection failed (ping): {e}. Falling back to memory.")
                self.redis = None # Ensure we fallback

    def get_history(self, session_id):
        if self.redis:
            try:
                data = self.redis.get(f"chat:{session_id}")
                return json.loads(data) if data else []
            except Exception as e:
                print(f"Redis get failed: {e}")
                return self.local_storage.get(session_id, [])
        return self.local_storage.get(session_id, [])
    
    def save_history(self, session_id, history):
        if self.redis:
            try:
                self.redis.set(f"chat:{session_id}", json.dumps(history), ex=3600)
            except Exception as e:
                print(f"Redis set failed: {e}")
                self.local_storage[session_id] = history
        else:
            self.local_storage[session_id] = history

memory = ChatMemory()

RESUME_TEMPLATE_CONTEXT = """
You are 'Tekton AI', a professional and friendly resume builder. 
Your goal is to help the user build a high-quality resume based on the 'Manish Prakkash' template.
The Manish Prakkash template has the following sections:
- Header: Name, Contact, LinkedIn, Github.
- EDUCATION: College (with CGPA), Schooling (with percentages).
- PROJECTS: Title, Github Link, Tech Stack, Key Features.
- ACHIEVEMENTS: Bullet points of awards/ranks.
- CODING PROFILES: Platforms like Leetcode, HackerRank, etc.
- CERTIFICATIONS: Core certifications with years.
- TECHNICAL SKILLS: Languages, Tech/Frameworks, Databases, Deployment, Tools, Core Concepts (DSA, OOPS, DBMS).

CONVERSATIONAL RULES:
1. Talk like a normal person. Be friendly and smart. 
2. Use phrases like "Hey there! Ready to build something great?", "Oh, cool! What about...", "Got it. Let's move to...", "Hey, wait, we were talking about your education earlier, should we finish that first?".
3. Instead of "Given", use "So, I'll need your...", "Can you tell me about...", "How's your...".
4. Ask ONLY ONE question at a time. Do not overwhelm the user.
5. If the user changes the topic, answer them nicely, but then gently guide them back: "Anyway, regarding that certification you mentioned earlier, where were we?".
6. Your tone should be encouraging.

STRATEGY:
- Start with a warm greeting.
- Ask for their full name and contact info.
- Then proceed section by section.
"""

@app.route("/chat-builder/history/<session_id>", methods=["GET"])
def get_history(session_id):
    try:
        history = memory.get_history(session_id)
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/chat-builder", methods=["POST"])
def chat():
    data = request.get_json()
    session_id = data.get("session_id", "default")
    user_message = data.get("message", "")
    
    if not user_message:
        return jsonify({"error": "No message"}), 400

    # Retrieve history from "Redis" (memory)
    history = memory.get_history(session_id)
    
    # Construct messages for Groq
    messages = [
        {"role": "system", "content": RESUME_TEMPLATE_CONTEXT}
    ]
    
    # Add history (last 10 messages for context)
    for msg in history[-10:]:
        messages.append(msg)
        
    # Add current user message
    messages.append({"role": "user", "content": user_message})

    def generate():
        try:
            full_response = ""
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                temperature=0.8,
                max_completion_tokens=1024,
                top_p=1,
                stream=True,
            )

            for chunk in completion:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    yield content
            
            # Save the interaction back to "Redis"
            history.append({"role": "user", "content": user_message})
            history.append({"role": "assistant", "content": full_response})
            memory.save_history(session_id, history)
            
        except Exception as e:
            yield f"Error: {str(e)}"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

if __name__ == "__main__":
    print("Tekton AI Backend (Resume Builder) starting on port 5001...")
    app.run(debug=True, port=5001)
