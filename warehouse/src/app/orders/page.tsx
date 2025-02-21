'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Order {
  id: string;
  status: string;
  customerName: string;
  orderDate: string;
  items: Array<{
    partId: string;
    quantity: number;
    partName: string;
  }>;
}

export default function OrdersPage() {
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [closedOrders, setClosedOrders] = useState<Order[]>([]);

  useEffect(() => {
    // Subscribe to orders collection
    const ordersQuery = query(
      collection(db, 'open-orders'),
    );

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const open: Order[] = [];
      const closed: Order[] = [];

      snapshot.forEach((doc) => {
        const order = { id: doc.id, ...doc.data() } as Order;
        if (order.status === 'closed') {
          closed.push(order);
        } else {
          open.push(order);
        }
      });

      setOpenOrders(open);
      setClosedOrders(closed);
    });

    return () => unsubscribe();
  }, []);

  const handleCloseOrder = async (orderId: string) => {
    try {
      const orderRef = doc(db, 'open-orders', orderId);
      await updateDoc(orderRef, {
        status: 'closed'
      });
    } catch (error) {
      console.error('Error closing order:', error);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Warehouse Orders</h1>
      
      {/* Open Orders Section */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Open Orders</h2>
        <div className="grid gap-4">
          {openOrders.map((order) => (
            <div key={order.id} className="border rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-medium">{order.customerName}</h3>
                  <p className="text-sm text-gray-500">Order Date: {order.orderDate}</p>
                </div>
                <button
                  onClick={() => handleCloseOrder(order.id)}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  Complete Order
                </button>
              </div>
              <ul className="list-disc list-inside">
                {order.items.map((item, index) => (
                  <li key={index} className="text-sm">
                    {item.partName} - Quantity: {item.quantity}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Closed Orders Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Closed Orders</h2>
        <div className="grid gap-4">
          {closedOrders.map((order) => (
            <div key={order.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              <div>
                <h3 className="font-medium">{order.customerName}</h3>
                <p className="text-sm text-gray-500">Order Date: {order.orderDate}</p>
              </div>
              <ul className="list-disc list-inside mt-2">
                {order.items.map((item, index) => (
                  <li key={index} className="text-sm">
                    {item.partName} - Quantity: {item.quantity}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
} 