import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';

class ProductionScreen extends StatefulWidget {
  const ProductionScreen({super.key});

  @override
  State<ProductionScreen> createState() => _ProductionScreenState();
}

class _ProductionScreenState extends State<ProductionScreen> {
  final List<ProductionOrder> _orders = [];
  bool _loading = false;
  bool _hasMore = true;
  int _page = 0;
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _load();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 200) {
        if (!_loading && _hasMore) _load();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    if (reset) {
      _orders.clear();
      _page = 0;
      _hasMore = true;
    }
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getProductionOrders(page: _page, size: 20);
      final items = raw.map((e) => ProductionOrder.fromJson(e)).toList();
      setState(() {
        _orders.addAll(items);
        _page++;
        _hasMore = items.length == 20;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  static const _statusColors = {
    'PENDING': Color(0xFFFF9800),
    'IN_PROGRESS': Color(0xFF2196F3),
    'COMPLETED': Color(0xFF4CAF50),
    'CANCELLED': Color(0xFF9E9E9E),
    'ON_HOLD': Color(0xFFFF9800),
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_outlined),
          onPressed: openAppDrawer,
          tooltip: 'Open menu',
        ),
        title: const Text('Production'),
        backgroundColor: const Color(0xFF9C27B0),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _load(reset: true),
          ),
        ],
      ),
      body: _orders.isEmpty && !_loading
          ? const Center(child: Text('No production orders found'))
          : RefreshIndicator(
              onRefresh: () => _load(reset: true),
              child: ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(12),
                itemCount: _orders.length + (_loading ? 1 : 0),
                itemBuilder: (ctx, i) {
                  if (i >= _orders.length) {
                    return const Center(
                        child: Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(),
                    ));
                  }
                  final order = _orders[i];
                  final color = _statusColors[order.status] ?? const Color(0xFF9E9E9E);
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(color: Colors.grey.withOpacity(0.15)),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => _showDetail(context, order),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: color.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(
                                      Icons.precision_manufacturing_outlined,
                                      color: color,
                                      size: 20),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(order.poNumber,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold)),
                                      if (order.pipeConfig != null)
                                        Text(order.pipeConfig!,
                                            style: const TextStyle(
                                                fontSize: 12, color: Colors.grey)),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: color.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(order.status,
                                      style: TextStyle(
                                          fontSize: 10,
                                          color: color,
                                          fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                    '${order.completedQuantity.toStringAsFixed(0)} / ${order.targetQuantity.toStringAsFixed(0)} units',
                                    style: const TextStyle(
                                        fontSize: 12, color: Colors.grey)),
                                Text(
                                    '${(order.progressPercent * 100).toStringAsFixed(0)}%',
                                    style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: color)),
                              ],
                            ),
                            const SizedBox(height: 6),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: order.progressPercent,
                                minHeight: 6,
                                backgroundColor: color.withOpacity(0.15),
                                valueColor: AlwaysStoppedAnimation(color),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddEntrySheet(context, null),
        backgroundColor: const Color(0xFF9C27B0),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Record Entry'),
      ),
    );
  }

  void _showDetail(BuildContext context, ProductionOrder order) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _ProductionDetailSheet(
          order: order, onAddEntry: () => _showAddEntrySheet(context, order)),
    );
  }

  void _showAddEntrySheet(BuildContext context, ProductionOrder? order) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _AddEntrySheet(
          selectedOrder: order, onAdded: () => _load(reset: true)),
    );
  }
}

class _ProductionDetailSheet extends StatefulWidget {
  final ProductionOrder order;
  final VoidCallback onAddEntry;
  const _ProductionDetailSheet({required this.order, required this.onAddEntry});

  @override
  State<_ProductionDetailSheet> createState() => _ProductionDetailSheetState();
}

class _ProductionDetailSheetState extends State<_ProductionDetailSheet> {
  List<ProductionEntry> _entries = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadEntries();
  }

  Future<void> _loadEntries() async {
    try {
      final raw = await ApiService().getEntriesByOrder(widget.order.id);
      setState(() {
        _entries = raw.map((e) => ProductionEntry.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      expand: false,
      builder: (_, ctrl) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.order.poNumber,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold)),
                      if (widget.order.pipeConfig != null)
                        Text(widget.order.pipeConfig!,
                            style: const TextStyle(color: Colors.grey)),
                    ],
                  ),
                ),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    widget.onAddEntry();
                  },
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Add Entry'),
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF9C27B0),
                      visualDensity: VisualDensity.compact),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: widget.order.progressPercent,
                minHeight: 8,
              ),
            ),
            Text(
                '${widget.order.completedQuantity.toStringAsFixed(0)} / ${widget.order.targetQuantity.toStringAsFixed(0)} units',
                style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const Divider(height: 20),
            const Text('Production Entries',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_entries.isEmpty)
              const Center(child: Text('No entries yet'))
            else
              Expanded(
                child: ListView.builder(
                  controller: ctrl,
                  itemCount: _entries.length,
                  itemBuilder: (_, i) {
                    final e = _entries[i];
                    return ListTile(
                      dense: true,
                      leading: const Icon(Icons.check_circle_outline,
                          color: Color(0xFF9C27B0)),
                      title: Text('${e.quantityProduced.toStringAsFixed(0)} units'
                          '${e.stage != null ? ' — ${e.stage}' : ''}'),
                      subtitle: Text(e.machine ?? '',
                          style: const TextStyle(fontSize: 11)),
                      trailing: e.createdAt != null
                          ? Text(
                              DateFormat('dd MMM').format(
                                  DateTime.parse(e.createdAt!)),
                              style: const TextStyle(
                                  fontSize: 11, color: Colors.grey))
                          : null,
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _AddEntrySheet extends StatefulWidget {
  final ProductionOrder? selectedOrder;
  final VoidCallback onAdded;
  const _AddEntrySheet({this.selectedOrder, required this.onAdded});

  @override
  State<_AddEntrySheet> createState() => _AddEntrySheetState();
}

class _AddEntrySheetState extends State<_AddEntrySheet> {
  List<ProductionOrder> _orders = [];
  ProductionOrder? _pickedOrder;
  final _qtyCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String? _stage;
  bool _loading = true;
  bool _saving = false;

  final _stages = ['MIXING', 'CASTING', 'CURING', 'TESTING', 'FINISHING'];

  @override
  void initState() {
    super.initState();
    _pickedOrder = widget.selectedOrder;
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    try {
      final raw = await ApiService().getProductionOrders(size: 50);
      setState(() {
        _orders = raw.map((e) => ProductionOrder.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Record Production Entry',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else
            DropdownButtonFormField<ProductionOrder>(
              value: _pickedOrder,
              decoration: const InputDecoration(
                labelText: 'Production Order',
                border: OutlineInputBorder(),
              ),
              items: _orders
                  .map((o) =>
                      DropdownMenuItem(value: o, child: Text(o.poNumber)))
                  .toList(),
              onChanged: (v) => setState(() => _pickedOrder = v),
            ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _stage,
            decoration: const InputDecoration(
              labelText: 'Stage',
              border: OutlineInputBorder(),
            ),
            items: _stages
                .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                .toList(),
            onChanged: (v) => setState(() => _stage = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _qtyCtrl,
            decoration: const InputDecoration(
              labelText: 'Quantity Produced',
              border: OutlineInputBorder(),
            ),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notesCtrl,
            decoration: const InputDecoration(
              labelText: 'Notes (optional)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _submit,
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF9C27B0)),
              child: _saving
                  ? const SizedBox(
                      height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Save Entry'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    if (_pickedOrder == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Select a production order')));
      return;
    }
    final qty = double.tryParse(_qtyCtrl.text.trim());
    if (qty == null || qty <= 0) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Enter a valid quantity')));
      return;
    }
    setState(() => _saving = true);
    try {
      await ApiService().createProductionEntry({
        'productionOrderId': _pickedOrder!.id,
        'stage': _stage,
        'quantityProduced': qty,
        'notes': _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
      widget.onAdded();
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}
