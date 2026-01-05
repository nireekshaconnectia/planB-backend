const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const CateringOrder = require('../models/CateringOrder');

describe('Catering Orders API', () => {
    beforeAll(async () => {
        // Connect to test database
        await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/test');
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Clear catering orders before each test
        await CateringOrder.deleteMany({});
    });

    describe('POST /api/catering-orders', () => {
        it('should create a new catering order', async () => {
            const orderData = {
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
                deliveryDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
                deliveryTime: '12:00 PM',
                paymentMethod: 'online',
                specialInstructions: 'Please deliver to the main entrance'
            };

            const response = await request(app)
                .post('/api/catering-orders')
                .send(orderData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.orderId).toBe('CAT-001');
            expect(response.body.data.customerName).toBe('John Doe');
            expect(response.body.data.numberOfPeople).toBe(25);
            expect(response.body.data.total).toBe(89.95);
        });

        it('should reject order without policy acceptance', async () => {
            const orderData = {
                orderId: 'CAT-002',
                customerName: 'Jane Smith',
                customerPhone: '+1234567891',
                location: 'Conference Center',
                address: {
                    line1: '456 Oak Ave',
                    city: 'Los Angeles',
                    state: 'CA',
                    postalCode: '90210',
                    country: 'USA'
                },
                policyAccepted: false, // This should cause validation error
                items: [
                    {
                        foodSlug: 'sandwich-club',
                        foodName: 'Club Sandwich',
                        quantity: 10,
                        foodPrice: 8.99,
                        totalPrice: 89.90
                    }
                ],
                numberOfPeople: 15,
                deliveryCharge: 5.00,
                subtotal: 89.90,
                total: 94.90,
                deliveryDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                deliveryTime: '1:00 PM',
                paymentMethod: 'cash'
            };

            const response = await request(app)
                .post('/api/catering-orders')
                .send(orderData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('validation');
        });
    });

    describe('GET /api/catering-orders/phone/:phoneNumber', () => {
        it('should get catering orders by phone number', async () => {
            // Create a test order first
            const orderData = {
                orderId: 'CAT-003',
                customerName: 'Bob Wilson',
                customerPhone: '+1234567892',
                location: 'Event Hall',
                address: {
                    line1: '789 Pine St',
                    city: 'Chicago',
                    state: 'IL',
                    postalCode: '60601',
                    country: 'USA'
                },
                policyAccepted: true,
                items: [
                    {
                        foodSlug: 'pasta-carbonara',
                        foodName: 'Pasta Carbonara',
                        quantity: 8,
                        foodPrice: 12.99,
                        totalPrice: 103.92
                    }
                ],
                numberOfPeople: 20,
                deliveryCharge: 15.00,
                subtotal: 103.92,
                total: 118.92,
                deliveryDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
                deliveryTime: '6:00 PM',
                paymentMethod: 'online'
            };

            await CateringOrder.create(orderData);

            const response = await request(app)
                .get('/api/catering-orders/phone/+1234567892')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.count).toBe(1);
            expect(response.body.data[0].orderId).toBe('CAT-003');
            expect(response.body.data[0].customerName).toBe('Bob Wilson');
        });
    });

    describe('GET /api/catering-orders/status/:orderId', () => {
        it('should get catering order status', async () => {
            // Create a test order first
            const orderData = {
                orderId: 'CAT-004',
                customerName: 'Alice Johnson',
                customerPhone: '+1234567893',
                location: 'Wedding Venue',
                address: {
                    line1: '321 Elm St',
                    city: 'Miami',
                    state: 'FL',
                    postalCode: '33101',
                    country: 'USA'
                },
                policyAccepted: true,
                items: [
                    {
                        foodSlug: 'chicken-biryani',
                        foodName: 'Chicken Biryani',
                        quantity: 12,
                        foodPrice: 18.99,
                        totalPrice: 227.88
                    }
                ],
                numberOfPeople: 50,
                deliveryCharge: 25.00,
                subtotal: 227.88,
                total: 252.88,
                deliveryDate: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
                deliveryTime: '7:00 PM',
                paymentMethod: 'online'
            };

            await CateringOrder.create(orderData);

            const response = await request(app)
                .get('/api/catering-orders/status/CAT-004')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.orderId).toBe('CAT-004');
            expect(response.body.data.status).toBe('pending');
            expect(response.body.data.customerName).toBe('Alice Johnson');
        });
    });
}); 