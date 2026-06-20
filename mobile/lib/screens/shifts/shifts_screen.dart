import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class ShiftsScreen extends ConsumerStatefulWidget {
  const ShiftsScreen({super.key});

  @override
  ConsumerState<ShiftsScreen> createState() => _ShiftsScreenState();
}

class _ShiftsScreenState extends ConsumerState<ShiftsScreen> {
  Shift? _currentShift;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = ref.read(authProvider);
    final userId = auth.user?.userId;
    if (userId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final raw = await ApiService().getCurrentShift(userId);
      setState(() {
        _currentShift = raw != null ? Shift.fromJson(raw) : null;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_outlined),
          onPressed: openAppDrawer,
          tooltip: 'Open menu',
        ),
        title: const Text('Shift Management'),
        backgroundColor: const Color(0xFF00BCD4),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.error_outline, color: cs.error, size: 48),
                      const SizedBox(height: 12),
                      Text(_error!),
                      const SizedBox(height: 16),
                      FilledButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      _ShiftStatusCard(shift: _currentShift, fmt: fmt),
                      const SizedBox(height: 24),
                      if (_currentShift == null || _currentShift!.status == 'CLOSED')
                        _OpenShiftCard(onOpened: _load)
                      else if (_currentShift!.status == 'OPEN')
                        _CloseShiftCard(
                            shift: _currentShift!, onClosed: _load, fmt: fmt),
                    ],
                  ),
                ),
    );
  }
}

class _ShiftStatusCard extends StatelessWidget {
  final Shift? shift;
  final NumberFormat fmt;
  const _ShiftStatusCard({required this.shift, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final isOpen = shift != null && shift!.status == 'OPEN';
    final color = isOpen ? const Color(0xFF4CAF50) : const Color(0xFF9E9E9E);

    return Card(
      elevation: 0,
      color: color.withOpacity(0.08),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: color.withOpacity(0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.18),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isOpen ? Icons.lock_open : Icons.lock,
                    color: color,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isOpen ? 'Shift Open' : 'No Active Shift',
                      style: TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold, color: color),
                    ),
                    if (shift != null && shift!.openedAt != null)
                      Text(
                        'Opened: ${_fmt(shift!.openedAt!)}',
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                  ],
                ),
              ],
            ),
            if (shift != null) ...[
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _StatItem(
                    label: 'Opening Balance',
                    value: fmt.format(shift!.openingBalance),
                  ),
                  if (shift!.totalSales != null)
                    _StatItem(
                      label: 'Total Sales',
                      value: fmt.format(shift!.totalSales!),
                    ),
                  if (shift!.cashierName != null)
                    _StatItem(label: 'Cashier', value: shift!.cashierName!),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _fmt(String dateStr) {
    try {
      return DateFormat('dd MMM, hh:mm a').format(DateTime.parse(dateStr));
    } catch (_) {
      return dateStr;
    }
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  const _StatItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }
}

class _OpenShiftCard extends ConsumerStatefulWidget {
  final VoidCallback onOpened;
  const _OpenShiftCard({required this.onOpened});

  @override
  ConsumerState<_OpenShiftCard> createState() => _OpenShiftCardState();
}

class _OpenShiftCardState extends ConsumerState<_OpenShiftCard> {
  final _balanceCtrl = TextEditingController(text: '0');
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Open Shift',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(
              controller: _balanceCtrl,
              decoration: const InputDecoration(
                labelText: 'Opening Balance (₹)',
                border: OutlineInputBorder(),
                prefixText: '₹ ',
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _open,
                icon: const Icon(Icons.lock_open),
                label: const Text('Open Shift'),
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFF4CAF50)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _open() async {
    final balance = double.tryParse(_balanceCtrl.text.trim()) ?? 0;
    final auth = ref.read(authProvider);
    setState(() => _saving = true);
    try {
      await ApiService().openShift({
        'openingBalance': balance,
        'cashierId': auth.user?.userId,
        'outletId': auth.user?.outletId,
      });
      widget.onOpened();
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}

class _CloseShiftCard extends StatefulWidget {
  final Shift shift;
  final VoidCallback onClosed;
  final NumberFormat fmt;
  const _CloseShiftCard(
      {required this.shift, required this.onClosed, required this.fmt});

  @override
  State<_CloseShiftCard> createState() => _CloseShiftCardState();
}

class _CloseShiftCardState extends State<_CloseShiftCard> {
  final _cashCtrl = TextEditingController(text: '0');
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: const Color(0xFFFF9800).withOpacity(0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: Color(0xFFFF9800), width: 0.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Close Shift',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(
              controller: _cashCtrl,
              decoration: const InputDecoration(
                labelText: 'Closing Cash Amount (₹)',
                border: OutlineInputBorder(),
                prefixText: '₹ ',
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _close,
                icon: const Icon(Icons.lock),
                label: const Text('Close Shift'),
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFFFF9800)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _close() async {
    final cash = double.tryParse(_cashCtrl.text.trim()) ?? 0;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Close Shift?'),
        content: const Text(
            'This will end the current shift. All sales will be finalized.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Close Shift')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _saving = true);
    try {
      await ApiService().closeShift(widget.shift.id, {'closingCash': cash});
      widget.onClosed();
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}
