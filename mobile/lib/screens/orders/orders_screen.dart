import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

final _ordersProvider = FutureProvider<List<Order>>((ref) async {
  final outletId = ref.watch(authProvider).user?.outletId;
  if (outletId == null) return [];
  return ApiService().getOrdersByOutlet(outletId);
});

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_ordersProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Orders'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_ordersProvider),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (orders) => orders.isEmpty
            ? const Center(child: Text('No orders yet'))
            : ListView.builder(
                itemCount: orders.length,
                itemBuilder: (ctx, i) {
                  final o = orders[i];
                  return Card(
                    margin: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 4),
                    child: ListTile(
                      title: Text(o.orderNumber,
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text(
                        '${o.customer?.name ?? 'Walk-in'}  •  ${o.items.length} items',
                      ),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '₹${o.totalAmount.toStringAsFixed(2)}',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF6C63FF)),
                          ),
                          _StatusBadge(status: o.status),
                        ],
                      ),
                      onTap: () => showDialog(
                        context: context,
                        builder: (_) => _OrderDetailDialog(order: o),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'COMPLETED' => Colors.green,
      'CANCELLED' => Colors.red,
      'REFUNDED' => Colors.orange,
      _ => Colors.grey,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(status,
          style: TextStyle(color: color, fontSize: 10)),
    );
  }
}

class _OrderDetailDialog extends StatelessWidget {
  final Order order;
  const _OrderDetailDialog({required this.order});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(order.orderNumber),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (order.customer != null) ...[
              Text('Customer: ${order.customer!.name}',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
            ],
            const Text('Items:', style: TextStyle(fontWeight: FontWeight.w600)),
            ...order.items.map((item) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Expanded(child: Text(item.productName)),
                      Text('${item.quantity.toStringAsFixed(0)} × ₹${item.unitPrice.toStringAsFixed(2)}'),
                    ],
                  ),
                )),
            const Divider(),
            _Row('Subtotal', order.subtotal),
            if (order.discountAmount > 0)
              _Row('Discount', -order.discountAmount, color: Colors.green),
            _Row('Tax', order.taxAmount),
            const Divider(),
            _Row('Total', order.totalAmount, bold: true),
            const SizedBox(height: 8),
            const Text('Payments:', style: TextStyle(fontWeight: FontWeight.w600)),
            ...order.payments.map((p) => _Row(p.paymentMethod, p.amount)),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close')),
      ],
    );
  }

  Widget _Row(String label, double amount, {Color? color, bool bold = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: TextStyle(
                    color: color,
                    fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
            Text('₹${amount.abs().toStringAsFixed(2)}',
                style: TextStyle(
                    color: color,
                    fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          ],
        ),
      );
}
