import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  final List<Order> _orders = [];
  int _page = 0;
  bool _loading = false;
  bool _hasMore = true;
  final ScrollController _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
            _scrollCtrl.position.maxScrollExtent - 150 &&
        !_loading &&
        _hasMore) {
      _load();
    }
  }

  Future<void> _load({bool reset = false}) async {
    final outletId = ref.read(authProvider).user?.outletId;
    if (outletId == null) return;
    if (_loading) return;
    if (reset) {
      _orders.clear();
      _page = 0;
      _hasMore = true;
    }
    setState(() => _loading = true);
    try {
      final batch = await ApiService()
          .getOrdersByOutletPaged(outletId, page: _page, size: 20);
      setState(() {
        _orders.addAll(batch);
        _page++;
        if (batch.length < 20) _hasMore = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_outlined),
          onPressed: openAppDrawer,
          tooltip: 'Open menu',
        ),
        title: const Text('Orders'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _load(reset: true),
          ),
        ],
      ),
      body: _orders.isEmpty && _loading
          ? const Center(child: CircularProgressIndicator())
          : _orders.isEmpty
              ? const Center(child: Text('No orders yet'))
              : ListView.builder(
                  controller: _scrollCtrl,
                  itemCount: _orders.length + (_hasMore ? 1 : 0),
                  itemBuilder: (ctx, i) {
                    if (i == _orders.length) {
                      return const Center(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: CircularProgressIndicator(),
                        ),
                      );
                    }
                    final o = _orders[i];
                    return Card(
                      margin: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                      child: ListTile(
                        title: Text(o.orderNumber,
                            style:
                                const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(
                          '${o.customer?.name ?? 'Walk-in'}  •  ${o.items.length} items  •  ${_fmtDate(o.createdAt)}',
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
                          builder: (_) => _OrderDetailDialog(
                            order: o,
                            onCancelled: () => _load(reset: true),
                          ),
                        ),
                      ),
                    );
                  },
                ),
    );
  }

  String _fmtDate(String iso) {
    if (iso.isEmpty) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
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
      'HELD' => Colors.blue,
      _ => Colors.grey,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(status, style: TextStyle(color: color, fontSize: 10)),
    );
  }
}

class _OrderDetailDialog extends StatefulWidget {
  final Order order;
  final VoidCallback onCancelled;
  const _OrderDetailDialog(
      {required this.order, required this.onCancelled});

  @override
  State<_OrderDetailDialog> createState() => _OrderDetailDialogState();
}

class _OrderDetailDialogState extends State<_OrderDetailDialog> {
  late Order _order;
  bool _cancelling = false;

  @override
  void initState() {
    super.initState();
    _order = widget.order;
  }

  bool get _canCancel =>
      _order.status != 'COMPLETED' &&
      _order.status != 'CANCELLED' &&
      _order.status != 'REFUNDED';

  Future<void> _cancelOrder() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Order'),
        content: Text(
            'Are you sure you want to cancel order ${_order.orderNumber}?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('No')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Yes, Cancel',
                style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _cancelling = true);
    try {
      final updated = await ApiService().cancelOrder(_order.id);
      setState(() => _order = updated);
      widget.onCancelled();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Order cancelled'),
              backgroundColor: Colors.orange),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: [
          Expanded(child: Text(_order.orderNumber)),
          _StatusBadge(status: _order.status),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_order.customer != null) ...[
              Text('Customer: ${_order.customer!.name}',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
            ],
            const Text('Items:',
                style: TextStyle(fontWeight: FontWeight.w600)),
            ..._order.items.map((item) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Expanded(child: Text(item.productName)),
                      Text(
                          '${item.quantity.toStringAsFixed(0)} × ₹${item.unitPrice.toStringAsFixed(2)}'),
                    ],
                  ),
                )),
            const Divider(),
            _Row('Subtotal', _order.subtotal),
            if (_order.discountAmount > 0)
              _Row('Discount', -_order.discountAmount, color: Colors.green),
            _Row('Tax', _order.taxAmount),
            const Divider(),
            _Row('Total', _order.totalAmount, bold: true),
            const SizedBox(height: 8),
            const Text('Payments:',
                style: TextStyle(fontWeight: FontWeight.w600)),
            ..._order.payments.map((p) => _Row(p.paymentMethod, p.amount)),
          ],
        ),
      ),
      actions: [
        if (_canCancel)
          TextButton.icon(
            icon: _cancelling
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.cancel_outlined, color: Colors.red),
            label: const Text('Cancel Order',
                style: TextStyle(color: Colors.red)),
            onPressed: _cancelling ? null : _cancelOrder,
          ),
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close')),
      ],
    );
  }

  Widget _Row(String label, double amount,
      {Color? color, bool bold = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: TextStyle(
                    color: color,
                    fontWeight:
                        bold ? FontWeight.bold : FontWeight.normal)),
            Text('₹${amount.abs().toStringAsFixed(2)}',
                style: TextStyle(
                    color: color,
                    fontWeight:
                        bold ? FontWeight.bold : FontWeight.normal)),
          ],
        ),
      );
}
