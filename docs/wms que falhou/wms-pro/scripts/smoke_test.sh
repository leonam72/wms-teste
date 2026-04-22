#!/bin/bash

API_BASE_URL="http://localhost:8000/api"

echo "--- Starting Backend Smoke Test ---"

# Test Product API (Inventory)
echo "Testing POST /products..."
# NOTE: Creating a product requires a minimal valid payload.
curl -X POST "$API_BASE_URL/products" 
  -H "Content-Type: application/json" 
  -d '{"code": "SMOKETEST123", "name": "Smoke Test Product", "unit": "UN", "quantity": 1, "kg_total": 0.5}' 
  -s -o /dev/null -w "%{http_code}
" || echo "Error running POST /products"

echo "Testing GET /products..."
curl "$API_BASE_URL/products" -s -o /dev/null -w "%{http_code}
" || echo "Error running GET /products"

echo "Testing GET /products/export/csv..."
curl "$API_BASE_URL/products/export/csv" -s -o /dev/null -w "%{http_code}
" || echo "Error running GET /products/export/csv"

# Test Separation API (basic reachability)
echo "Testing GET /separation/module-feed..."
curl "$API_BASE_URL/separation/module-feed" -s -o /dev/null -w "%{http_code}
" || echo "Error running GET /separation/module-feed"

# Test Sync API
echo "Testing GET /bootstrap..."
curl "$API_BASE_URL/bootstrap" -s -o /dev/null -w "%{http_code}
" || echo "Error running GET /bootstrap"

echo "Testing GET /meta..."
curl "$API_BASE_URL/meta" -s -o /dev/null -w "%{http_code}
" || echo "Error running GET /meta"

echo "Testing GET /unloads-state..."
curl "$API_BASE_URL/unloads-state" -s -o /dev/null -w "%{http_code}
" || echo "Error running GET /unloads-state"

echo "Testing GET /inventory-state..."
curl "$API_BASE_URL/inventory-state" -s -o /dev/null -w "%{http_code}
" || echo "Error running GET /inventory-state"

echo "Testing GET /floorplan-state..."
curl "$API_BASE_URL/floorplan-state" -s -o /dev/null -w "%{http_code}
" || echo "Error running GET /floorplan-state"

echo "--- Backend Smoke Test Finished ---"

exit 0
