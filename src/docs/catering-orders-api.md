# Catering Orders API Documentation

## Overview

The Catering Orders API provides endpoints for managing catering orders with all the same features as regular orders, plus specific fields for catering requirements.

## Base URL

```
/api/catering-orders
```

## Authentication

- **Public Routes**: Order creation, order tracking by phone, and status checking (no authentication required)
- **Private Routes**: Order management, viewing orders, and admin functions (Firebase authentication required)

## Endpoints

### 1. Create Catering Order

**POST** `/api/catering-orders`

Creates a new catering order. Supports guest checkout (no authentication required).

#### Request Body

```json
{
  "orderId": "CAT-001",
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "location": "Office Building",
  "address": {
    "line1": "123 Main St",
    "line2": "Suite 100",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA"
  },
  "policyAccepted": true,
  "items": [
    {
      "foodSlug": "pizza-margherita",
      "foodName": "Pizza Margherita",
      "quantity": 5,
      "foodPrice": 15.99,
      "totalPrice": 79.95
    }
  ],
  "numberOfPeople": 25,
  "deliveryCharge": 10.00,
  "subtotal": 79.95,
  "total": 89.95,
  "deliveryDate": "2024-01-15T12:00:00.000Z",
  "deliveryTime": "12:00 PM",
  "paymentMethod": "online",
  "specialInstructions": "Please deliver to the main entrance"
}
```

#### Required Fields

- `orderId`: Unique order identifier
- `customerName`: Customer's full name (2-50 characters)
- `customerPhone`: Valid phone number
- `location`: Event location (2-100 characters)
- `address`: Complete delivery address
- `policyAccepted`: Must be `true` to accept terms
- `items`: Array of food items (minimum 1 item)
- `numberOfPeople`: Number of people to serve (1-1000)
- `deliveryCharge`: Delivery fee (positive number)
- `subtotal`: Order subtotal before delivery charge
- `total`: Final total including delivery charge
- `deliveryDate`: ISO date (minimum 24 hours in advance)
- `deliveryTime`: Delivery time string
- `paymentMethod`: "online" or "cash"

#### Response

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "orderId": "CAT-001",
    "customerName": "John Doe",
    "customerPhone": "+1234567890",
    "location": "Office Building",
    "address": {
      "line1": "123 Main St",
      "line2": "Suite 100",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "USA"
    },
    "policyAccepted": true,
    "items": [...],
    "numberOfPeople": 25,
    "deliveryCharge": 10.00,
    "subtotal": 79.95,
    "total": 89.95,
    "status": "pending",
    "deliveryDate": "2024-01-15T12:00:00.000Z",
    "deliveryTime": "12:00 PM",
    "createdAt": "2024-01-13T10:30:00.000Z"
  }
}
```

### 2. Get Catering Orders by Phone

**GET** `/api/catering-orders/phone/:phoneNumber`

Retrieves all catering orders for a specific phone number (public route).

#### Response

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "orderId": "CAT-001",
      "customerName": "John Doe",
      "status": "pending",
      "total": 89.95,
      "deliveryDate": "2024-01-15T12:00:00.000Z"
    }
  ]
}
```

### 3. Get Catering Order Status

**GET** `/api/catering-orders/status/:orderId`

Retrieves the status of a specific catering order (public route).

#### Response

```json
{
  "success": true,
  "data": {
    "orderId": "CAT-001",
    "status": "pending",
    "customerName": "John Doe",
    "total": 89.95,
    "deliveryDate": "2024-01-15T12:00:00.000Z",
    "deliveryTime": "12:00 PM"
  }
}
```

### 4. Get All Catering Orders (Authenticated)

**GET** `/api/catering-orders`

Retrieves all catering orders for the authenticated user or all orders for admins.

**Headers**: `Authorization: Bearer <firebase_token>`

#### Response

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "orderId": "CAT-001",
      "customerName": "John Doe",
      "status": "pending",
      "total": 89.95,
      "createdAt": "2024-01-13T10:30:00.000Z"
    }
  ]
}
```

### 5. Get Single Catering Order

**GET** `/api/catering-orders/:id`

Retrieves a specific catering order by ID.

**Headers**: `Authorization: Bearer <firebase_token>`

#### Response

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "orderId": "CAT-001",
    "customerName": "John Doe",
    "customerPhone": "+1234567890",
    "location": "Office Building",
    "address": {...},
    "items": [...],
    "numberOfPeople": 25,
    "deliveryCharge": 10.00,
    "subtotal": 79.95,
    "total": 89.95,
    "status": "pending",
    "paymentDetails": {...},
    "deliveryDate": "2024-01-15T12:00:00.000Z",
    "deliveryTime": "12:00 PM",
    "createdAt": "2024-01-13T10:30:00.000Z"
  }
}
```

### 6. Update Catering Order Status

**PUT** `/api/catering-orders/:id/status`

Updates the status of a catering order (admin only).

**Headers**: `Authorization: Bearer <firebase_token>`

#### Request Body

```json
{
  "status": "confirmed"
}
```

#### Valid Status Values

- `pending`: Order received, awaiting confirmation
- `confirmed`: Order confirmed by admin
- `preparing`: Food is being prepared
- `out_for_delivery`: Order is being delivered
- `delivered`: Order has been delivered
- `cancelled`: Order has been cancelled

#### Response

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "orderId": "CAT-001",
    "status": "confirmed",
    "updatedAt": "2024-01-13T11:00:00.000Z"
  }
}
```

### 7. Delete Catering Order

**DELETE** `/api/catering-orders/:id`

Deletes a catering order (users can only delete their own orders, admins can delete any).

**Headers**: `Authorization: Bearer <firebase_token>`

#### Response

```json
{
  "success": true,
  "message": "Catering order deleted successfully"
}
```

## Order Status Flow

1. **pending** → Order created, awaiting admin confirmation
2. **confirmed** → Admin has confirmed the order
3. **preparing** → Kitchen is preparing the food
4. **out_for_delivery** → Order is being delivered
5. **delivered** → Order has been successfully delivered
6. **cancelled** → Order has been cancelled

## Validation Rules

### Customer Information
- `customerName`: 2-50 characters
- `customerPhone`: Valid phone number format
- `location`: 2-100 characters

### Address
- `line1`: 5-100 characters
- `city`: 2-50 characters
- `state`: 2-50 characters
- `postalCode`: 3-10 characters
- `country`: 2-50 characters

### Order Details
- `policyAccepted`: Must be `true`
- `items`: Minimum 1 item required
- `numberOfPeople`: 1-1000 people
- `deliveryCharge`: Positive number
- `deliveryDate`: Minimum 24 hours in advance
- `deliveryTime`: 1-20 characters

### Payment
- `paymentMethod`: "online" or "cash"
- All price fields must be positive numbers

## Error Responses

### Validation Error (400)

```json
{
  "success": false,
  "message": "Validation Error",
  "errors": [
    {
      "field": "customerName",
      "message": "Customer name must be between 2 and 50 characters"
    }
  ]
}
```

### Not Found (404)

```json
{
  "success": false,
  "message": "Catering order not found"
}
```

### Unauthorized (401)

```json
{
  "success": false,
  "message": "Authentication required"
}
```

### Forbidden (403)

```json
{
  "success": false,
  "message": "Not authorized to access this order"
}
```

## Real-time Updates

The API integrates with WebSocket services to provide real-time updates:
- New order notifications
- Order status changes
- Order updates

## Testing

Run the catering order tests:

```bash
npm test tests/cateringOrder.test.js
```

## Example Usage

### JavaScript/Node.js

```javascript
const axios = require('axios');

// Create a catering order
const createOrder = async () => {
  try {
    const response = await axios.post('/api/catering-orders', {
      orderId: 'CAT-001',
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      location: 'Office Building',
      address: {
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA'
      },
      policyAccepted: true,
      items: [
        {
          foodSlug: 'pizza-margherita',
          foodName: 'Pizza Margherita',
          quantity: 5,
          foodPrice: 15.99,
          totalPrice: 79.95
        }
      ],
      numberOfPeople: 25,
      deliveryCharge: 10.00,
      subtotal: 79.95,
      total: 89.95,
      deliveryDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      deliveryTime: '12:00 PM',
      paymentMethod: 'online'
    });
    
    console.log('Order created:', response.data);
  } catch (error) {
    console.error('Error creating order:', error.response.data);
  }
};

// Check order status
const checkStatus = async (orderId) => {
  try {
    const response = await axios.get(`/api/catering-orders/status/${orderId}`);
    console.log('Order status:', response.data);
  } catch (error) {
    console.error('Error checking status:', error.response.data);
  }
};
```

### cURL

```bash
# Create a catering order
curl -X POST http://localhost:3000/api/catering-orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "CAT-001",
    "customerName": "John Doe",
    "customerPhone": "+1234567890",
    "location": "Office Building",
    "address": {
      "line1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "USA"
    },
    "policyAccepted": true,
    "items": [
      {
        "foodSlug": "pizza-margherita",
        "foodName": "Pizza Margherita",
        "quantity": 5,
        "foodPrice": 15.99,
        "totalPrice": 79.95
      }
    ],
    "numberOfPeople": 25,
    "deliveryCharge": 10.00,
    "subtotal": 79.95,
    "total": 89.95,
    "deliveryDate": "2024-01-15T12:00:00.000Z",
    "deliveryTime": "12:00 PM",
    "paymentMethod": "online"
  }'

# Check order status
curl http://localhost:3000/api/catering-orders/status/CAT-001

# Get orders by phone
curl http://localhost:3000/api/catering-orders/phone/+1234567890
``` 