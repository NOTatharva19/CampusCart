import os
import sqlite3
import time
import json
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    generate_latest,
)

app = Flask(__name__)

DATABASE = os.environ.get("DATABASE_PATH", "campuscart.db")
Path(DATABASE).parent.mkdir(parents=True, exist_ok=True)

REQUESTS = Counter(
    "campuscart_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

LATENCY = Histogram(
    "campuscart_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["endpoint"],
)

ORDERS = Counter(
    "campuscart_orders_total",
    "Number of successfully placed demo orders",
)

PRODUCTS = [
    {
        "id": 1, "name": "Campus Backpack",
        "category": "Accessories", "price": 899,
        "emoji": "🎒", "description": "Everyday college essential",
        "rating": 4.8, "color": "lavender",
    },
    {
        "id": 2, "name": "Wireless Headphones",
        "category": "Electronics", "price": 1499,
        "emoji": "🎧", "description": "Your music, your space",
        "rating": 4.7, "color": "blue",
    },
    {
        "id": 3, "name": "Study Desk Lamp",
        "category": "Study", "price": 649,
        "emoji": "💡", "description": "Light up late-night study",
        "rating": 4.6, "color": "yellow",
    },
    {
        "id": 4, "name": "Running Sneakers",
        "category": "Fashion", "price": 1899,
        "emoji": "👟", "description": "Made for campus life",
        "rating": 4.9, "color": "pink",
    },
    {
        "id": 5, "name": "Notebook Set",
        "category": "Study", "price": 249,
        "emoji": "📚", "description": "Ideas start on paper",
        "rating": 4.5, "color": "green",
    },
    {
        "id": 6, "name": "Smart Watch",
        "category": "Electronics", "price": 2299,
        "emoji": "⌚", "description": "Keep up with your day",
        "rating": 4.4, "color": "blue",
    },
    {
        "id": 7, "name": "Travel Water Bottle",
        "category": "Accessories", "price": 399,
        "emoji": "🥤", "description": "Hydration on the go",
        "rating": 4.6, "color": "green",
    },
    {
        "id": 8, "name": "Classic Hoodie",
        "category": "Fashion", "price": 1199,
        "emoji": "🧥", "description": "Comfort between classes",
        "rating": 4.7, "color": "lavender",
    },
]


def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT NOT NULL,
                items_json TEXT NOT NULL,
                total REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)


init_db()


@app.before_request
def start_timer():
    request.start_time = time.perf_counter()


@app.after_request
def record_metrics(response):
    endpoint = request.endpoint or "unknown"

    if endpoint != "metrics":
        REQUESTS.labels(
            request.method, endpoint, str(response.status_code)
        ).inc()

        LATENCY.labels(endpoint).observe(
            time.perf_counter() - getattr(
                request, "start_time", time.perf_counter()
            )
        )

    return response


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/health")
def health():
    try:
        with get_db() as db:
            db.execute("SELECT 1")

        return jsonify(
            status="healthy",
            database="connected"
        ), 200

    except sqlite3.Error:
        return jsonify(
            status="unhealthy",
            database="error"
        ), 503


@app.get("/api/products")
def products():
    return jsonify(PRODUCTS)


@app.get("/api/orders")
def list_orders():
    with get_db() as db:
        rows = db.execute(
            "SELECT id, customer_name, total, created_at "
            "FROM orders ORDER BY id DESC"
        ).fetchall()

    return jsonify([dict(row) for row in rows])


@app.post("/api/checkout")
def checkout():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    items = data.get("items", [])

    if not name or len(name) > 100:
        return jsonify(error="Enter a valid name."), 400

    if not isinstance(items, list) or not items:
        return jsonify(error="Your cart is empty."), 400

    total = 0
    validated_items = []

    for item in items:
        if not isinstance(item, dict):
            return jsonify(error="Invalid cart item."), 400

        try:
            product_id = int(item["id"])
            quantity = int(item["quantity"])
        except (KeyError, TypeError, ValueError):
            return jsonify(error="Invalid cart item."), 400

        product = next(
            (p for p in PRODUCTS if p["id"] == product_id),
            None
        )

        if product is None or quantity < 1 or quantity > 20:
            return jsonify(
                error="Invalid product or quantity."
            ), 400

        total += product["price"] * quantity

        validated_items.append({
            "id": product_id,
            "name": product["name"],
            "quantity": quantity,
            "price": product["price"],
        })

    with get_db() as db:
        cursor = db.execute(
            "INSERT INTO orders "
            "(customer_name, items_json, total) "
            "VALUES (?, ?, ?)",
            (name, json.dumps(validated_items), total),
        )

        order_id = cursor.lastrowid

    ORDERS.inc()

    return jsonify(
        message="Demo order placed successfully!",
        order_id=order_id,
        total=total,
    ), 201


@app.get("/metrics")
def metrics():
    return app.response_class(
        generate_latest(),
        mimetype=CONTENT_TYPE_LATEST,
    )


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=8000,
        debug=False
    )
