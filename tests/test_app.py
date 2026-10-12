import pytest
from app import app, init_db


@pytest.fixture()
def client(tmp_path, monkeypatch):
    database = str(tmp_path / "test.db")
    monkeypatch.setattr("app.DATABASE", database)

    init_db()

    app.config["TESTING"] = True

    with app.test_client() as test_client:
        yield test_client


def test_homepage(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"CampusCart" in response.data


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json["status"] == "healthy"


def test_products(client):
    response = client.get("/api/products")
    assert response.status_code == 200

    products = response.json
    assert len(products) >= 1
    assert all("price" in product for product in products)


def test_checkout(client):
    response = client.post(
        "/api/checkout",
        json={
            "name": "Test Student",
            "items": [{"id": 1, "quantity": 2}],
        },
    )

    assert response.status_code == 201
    assert response.json["total"] == 1798
    assert response.json["order_id"] is not None


def test_checkout_rejects_empty_cart(client):
    response = client.post(
        "/api/checkout",
        json={
            "name": "Test Student",
            "items": [],
        },
    )

    assert response.status_code == 400


def test_metrics(client):
    response = client.get("/metrics")
    assert response.status_code == 200
    assert b"campuscart_http_requests_total" in response.data
