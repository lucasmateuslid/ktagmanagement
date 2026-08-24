import { useState, useEffect } from 'react';
import { Shipment, ShippingAddress, Tracker, Tag } from '../types';
import { storage } from '../services/storage';

export const useShipments = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = storage.subscribeShipments((data) => {
      setShipments(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const saveShipment = async (shipment: Shipment) => {
    await storage.saveShipment(shipment);
  };

  const updateShipmentStatus = async (id: string, status: Shipment['status'], trackingCode?: string) => {
    await storage.updateShipmentStatus(id, status, trackingCode);
  };

  const deleteShipment = async (id: string) => {
    await storage.deleteShipment(id);
  };

  return { shipments, loading, saveShipment, updateShipmentStatus, deleteShipment };
};

export const useShippingAddresses = (consultorId?: string) => {
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = storage.subscribeShippingAddresses(consultorId, (data) => {
      setAddresses(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [consultorId]);

  const saveAddress = async (address: ShippingAddress) => {
    await storage.saveShippingAddress(address);
  };

  const deleteAddress = async (id: string) => {
    await storage.deleteShippingAddress(id);
  };

  return { addresses, loading, saveAddress, deleteAddress };
};

export const useInventory = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeTags = storage.subscribeTags((data) => {
      setTags(data);
    });
    const unsubscribeTrackers = storage.subscribeTrackers(setTrackers);

    // Wait a bit for both to load
    const timeout = setTimeout(() => setLoading(false), 1000);

    return () => {
      unsubscribeTags();
      unsubscribeTrackers();
      clearTimeout(timeout);
    };
  }, []);

  const updateItemStatus = async (type: 'tag' | 'rastreador', id: string, status: string, shipmentId?: string) => {
    const updates: any = { status };
    if (shipmentId !== undefined) {
      updates.shipmentId = shipmentId;
    }
    if (type === 'tag') {
      const tag = tags.find((item) => item.id === id);
      if (tag) await storage.saveTag({ ...tag, ...updates });
    } else {
      const tracker = trackers.find((item) => item.id === id);
      if (tracker) await storage.saveTracker({ ...tracker, ...updates, updatedAt: Date.now() });
    }
  };

  return { tags, trackers, loading, updateItemStatus };
};
