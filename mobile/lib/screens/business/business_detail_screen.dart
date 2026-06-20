import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';

// ── Cement Bags ───────────────────────────────────────────────────────────────

class CementBagsScreen extends StatefulWidget {
  const CementBagsScreen({super.key});

  @override
  State<CementBagsScreen> createState() => _CementBagsScreenState();
}

class _CementBagsScreenState extends State<CementBagsScreen> {
  static const _color = Color(0xFF57534E);
  List<CementBag> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getCementBags();
      setState(() {
        _items = raw.map((e) => CementBag.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cement Bags'),
        backgroundColor: _color,
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? const Center(child: Text('No cement bag entries'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _items.length,
                      itemBuilder: (_, i) {
                        final item = _items[i];
                        return _BizCard(
                          icon: Icons.all_inbox_outlined,
                          color: _color,
                          title: '${item.quantity.toStringAsFixed(0)} bags',
                          subtitle: _fmtDate(item.date),
                          notes: item.notes,
                        );
                      },
                    ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAdd(context),
        backgroundColor: _color,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showAdd(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _SimpleAddSheet(
        title: 'Add Cement Bag Entry',
        accentColor: _color,
        fields: [
          _FieldDef('quantity', 'Quantity (bags)', TextInputType.number),
          _FieldDef('notes', 'Notes (optional)', TextInputType.text),
        ],
        onSubmit: (data) async {
          await ApiService().createCementBag({
            'quantity': double.tryParse(data['quantity'] ?? '0') ?? 0,
            'notes': data['notes'],
            'date': DateFormat('yyyy-MM-dd').format(DateTime.now()),
          });
          _load();
        },
      ),
    );
  }
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

class VehiclesScreen extends StatefulWidget {
  const VehiclesScreen({super.key});

  @override
  State<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends State<VehiclesScreen> {
  static const _color = Color(0xFFEA580C);
  List<VehicleEntry> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getVehicleEntries();
      setState(() {
        _items = raw.map((e) => VehicleEntry.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vehicles'),
        backgroundColor: _color,
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? const Center(child: Text('No vehicle entries'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _items.length,
                      itemBuilder: (_, i) {
                        final item = _items[i];
                        final parts = <String>[];
                        if (item.craneEnabled) {
                          parts.add(
                              'Crane: ${item.craneDiesel?.toStringAsFixed(1) ?? '-'} L'
                              ' · ${item.craneHours?.toStringAsFixed(1) ?? '-'} h');
                        }
                        if (item.jcbEnabled) {
                          parts.add(
                              'JCB: ${item.jcbDiesel?.toStringAsFixed(1) ?? '-'} L'
                              ' · ${item.jcbHours?.toStringAsFixed(1) ?? '-'} h');
                        }
                        return _BizCard(
                          icon: Icons.local_shipping_outlined,
                          color: _color,
                          title: _fmtDate(item.date),
                          subtitle: parts.isEmpty ? 'No equipment recorded' : parts.join('  '),
                          notes: item.notes,
                        );
                      },
                    ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAdd(context),
        backgroundColor: _color,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showAdd(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _VehicleAddSheet(
        accentColor: _color,
        onSubmit: (data) async {
          await ApiService().createVehicleEntry(data);
          _load();
        },
      ),
    );
  }
}

// ── Vehicle Add Sheet ─────────────────────────────────────────────────────────

class _VehicleAddSheet extends StatefulWidget {
  final Color accentColor;
  final Future<void> Function(Map<String, dynamic>) onSubmit;

  const _VehicleAddSheet({required this.accentColor, required this.onSubmit});

  @override
  State<_VehicleAddSheet> createState() => _VehicleAddSheetState();
}

class _VehicleAddSheetState extends State<_VehicleAddSheet>
    with TickerProviderStateMixin {
  bool _craneEnabled = false;
  bool _jcbEnabled = false;
  bool _saving = false;
  DateTime _date = DateTime.now();

  final _craneDieselCtrl = TextEditingController();
  final _craneHoursCtrl = TextEditingController();
  final _jcbDieselCtrl = TextEditingController();
  final _jcbHoursCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  static const _orange = Color(0xFFEA580C);
  static const _deepOrange = Color(0xFFC2410C);

  @override
  void dispose() {
    _craneDieselCtrl.dispose();
    _craneHoursCtrl.dispose();
    _jcbDieselCtrl.dispose();
    _jcbHoursCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: _orange),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await widget.onSubmit({
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'craneEnabled': _craneEnabled,
        'craneDiesel': _craneEnabled ? _craneDieselCtrl.text.trim() : '',
        'craneHours':  _craneEnabled ? _craneHoursCtrl.text.trim()  : '',
        'jcbEnabled': _jcbEnabled,
        'jcbDiesel': _jcbEnabled ? _jcbDieselCtrl.text.trim() : '',
        'jcbHours':  _jcbEnabled ? _jcbHoursCtrl.text.trim()  : '',
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Widget _equipCard({
    required String label,
    required String subtitle,
    required IconData icon,
    required bool enabled,
    required VoidCallback onToggle,
    required List<Widget> fields,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeInOut,
      decoration: BoxDecoration(
        color: enabled ? _orange.withOpacity(0.05) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: enabled ? _orange : Colors.grey.shade200,
          width: enabled ? 1.5 : 1,
        ),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: enabled ? _orange : Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(icon,
                        color: enabled ? Colors.white : Colors.grey.shade500,
                        size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label,
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: enabled
                                    ? const Color(0xFF1A1A1A)
                                    : Colors.grey.shade600)),
                        Text(subtitle,
                            style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade500)),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: onToggle,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      width: 52,
                      height: 28,
                      decoration: BoxDecoration(
                        color: enabled ? _orange : Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: AnimatedAlign(
                        duration: const Duration(milliseconds: 250),
                        curve: Curves.easeInOut,
                        alignment: enabled
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.all(3),
                          width: 22,
                          height: 22,
                          decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle),
                          child: enabled
                              ? const Icon(Icons.check,
                                  size: 12, color: _orange)
                              : null,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeInOut,
            child: enabled
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Column(children: fields),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _iconField({
    required TextEditingController ctrl,
    required String label,
    required String hint,
    required IconData icon,
    required Color iconColor,
  }) =>
      Padding(
        padding: const EdgeInsets.only(top: 10),
        child: TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            prefixIcon: Container(
              margin: const EdgeInsets.all(8),
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 16, color: iconColor),
            ),
            filled: true,
            fillColor: Colors.white,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: _orange, width: 1.5),
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Gradient header
          Container(
            margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_orange, _deepOrange],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.local_shipping_rounded,
                      color: Colors.white, size: 28),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Vehicle Entry',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.3)),
                      SizedBox(height: 2),
                      Text('Record daily equipment usage',
                          style: TextStyle(
                              color: Colors.white70, fontSize: 13)),
                    ],
                  ),
                ),
                // Date pill
                GestureDetector(
                  onTap: _pickDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: Colors.white.withOpacity(0.4)),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.calendar_today_rounded,
                            color: Colors.white, size: 14),
                        const SizedBox(height: 3),
                        Text(
                          DateFormat('dd MMM').format(_date),
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Scrollable body
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                  16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text('Equipment',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey.shade500,
                            letterSpacing: 0.8)),
                  ),

                  // Crane card
                  _equipCard(
                    label: 'Crane',
                    subtitle: 'Diesel consumption & hours',
                    icon: Icons.precision_manufacturing_outlined,
                    enabled: _craneEnabled,
                    onToggle: () =>
                        setState(() => _craneEnabled = !_craneEnabled),
                    fields: [
                      _iconField(
                        ctrl: _craneDieselCtrl,
                        label: 'Diesel (Litres)',
                        hint: '0.0',
                        icon: Icons.local_gas_station_outlined,
                        iconColor: const Color(0xFFEF4444),
                      ),
                      _iconField(
                        ctrl: _craneHoursCtrl,
                        label: 'Hours',
                        hint: '0.0',
                        icon: Icons.schedule_outlined,
                        iconColor: const Color(0xFF3B82F6),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  // JCB card
                  _equipCard(
                    label: 'JCB',
                    subtitle: 'Diesel consumption & hours',
                    icon: Icons.construction_outlined,
                    enabled: _jcbEnabled,
                    onToggle: () =>
                        setState(() => _jcbEnabled = !_jcbEnabled),
                    fields: [
                      _iconField(
                        ctrl: _jcbDieselCtrl,
                        label: 'Diesel (Litres)',
                        hint: '0.0',
                        icon: Icons.local_gas_station_outlined,
                        iconColor: const Color(0xFFEF4444),
                      ),
                      _iconField(
                        ctrl: _jcbHoursCtrl,
                        label: 'Hours',
                        hint: '0.0',
                        icon: Icons.schedule_outlined,
                        iconColor: const Color(0xFF3B82F6),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text('Notes',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey.shade500,
                            letterSpacing: 0.8)),
                  ),
                  TextField(
                    controller: _notesCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'Any additional notes...',
                      hintStyle: TextStyle(color: Colors.grey.shade400),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      contentPadding: const EdgeInsets.all(14),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade200),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade200),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide:
                            const BorderSide(color: _orange, width: 1.5),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Save button
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: _saving
                        ? Container(
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                  colors: [_orange, _deepOrange]),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Center(
                              child: SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    valueColor: AlwaysStoppedAnimation(
                                        Colors.white)),
                              ),
                            ),
                          )
                        : GestureDetector(
                            onTap: _submit,
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                    colors: [_orange, _deepOrange]),
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: _orange.withOpacity(0.4),
                                    blurRadius: 12,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.check_circle_outline_rounded,
                                      color: Colors.white, size: 20),
                                  SizedBox(width: 8),
                                  Text('Save Entry',
                                      style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 0.3)),
                                ],
                              ),
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Silo ──────────────────────────────────────────────────────────────────────

class SiloScreen extends StatefulWidget {
  const SiloScreen({super.key});

  @override
  State<SiloScreen> createState() => _SiloScreenState();
}

class _SiloScreenState extends State<SiloScreen> {
  static const _color = Color(0xFF0D9488);
  List<SiloEntry> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getSiloEntries();
      setState(() {
        _items = raw.map((e) => SiloEntry.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Silo'),
        backgroundColor: _color,
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? const Center(child: Text('No silo entries'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _items.length,
                      itemBuilder: (_, i) {
                        final item = _items[i];
                        return _BizCard(
                          icon: Icons.storage_outlined,
                          color: _color,
                          title: item.siloName ?? 'Silo Entry',
                          subtitle: item.extracted != null
                              ? 'Extracted: ${item.extracted!.toStringAsFixed(1)} units'
                              : _fmtDate(item.date),
                          notes: item.notes,
                        );
                      },
                    ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAdd(context),
        backgroundColor: _color,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showAdd(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _SimpleAddSheet(
        title: 'Record Silo Extraction',
        accentColor: _color,
        fields: [
          _FieldDef('siloName', 'Silo Name', TextInputType.text),
          _FieldDef('extractedAmount', 'Extracted Amount', TextInputType.number),
          _FieldDef('notes', 'Notes', TextInputType.text),
        ],
        onSubmit: (data) async {
          await ApiService().createSiloEntry({
            'siloName': data['siloName'],
            'extractedAmount': double.tryParse(data['extractedAmount'] ?? '0'),
            'notes': data['notes'],
            'date': DateFormat('yyyy-MM-dd').format(DateTime.now()),
          });
          _load();
        },
      ),
    );
  }
}

// ── Loading ───────────────────────────────────────────────────────────────────

class _ReadinessRow {
  final String pipeName;
  final int day5;
  final int day6;
  final int day7plus;
  final int finalTesting;
  const _ReadinessRow({required this.pipeName, required this.day5, required this.day6, required this.day7plus, required this.finalTesting});
}

class LoadingScreen extends StatefulWidget {
  const LoadingScreen({super.key});
  @override
  State<LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends State<LoadingScreen> {
  static const _color  = Color(0xFF0D9488);
  static const _violet = Color(0xFF7C3AED);

  bool _loadingData = true;
  List<_ReadinessRow> _rows = [];
  List<Map<String, dynamic>> _records = [];
  List<String> _vendorNames    = [];
  List<String> _customerNames  = [];
  List<String> _allAddresses   = [];
  Map<String, List<String>> _customerAddressMap = {};
  bool _showHistory = false;
  String _recSearch = '';

  late DateTime _from;
  late DateTime _to;

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _loadAll();
  }

  String _fmt(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _loadAll() async {
    setState(() => _loadingData = true);

    List c2Entries = [], ftEntries = [], records = [];
    try {
      final r = await Future.wait([
        ApiService().getProductionEntries(stageType: 'CURING_2',      from: _fmt(_from), to: _fmt(_to)),
        ApiService().getProductionEntries(stageType: 'FINAL_TESTING',  from: _fmt(_from), to: _fmt(_to)),
        ApiService().getLoadingRecords(from: _fmt(_from), to: _fmt(_to)),
      ]);
      c2Entries = r[0]; ftEntries = r[1]; records = r[2];
    } catch (_) {}

    List vendors = [], salesOrders = [], customers = [];
    try { vendors     = await ApiService().getVendors(size: 500); }     catch (_) {}
    try { salesOrders = await ApiService().getSalesOrders(size: 500); } catch (_) {}
    try { customers   = await ApiService().getAllCustomers(size: 500); } catch (_) {}

    final today   = DateTime.now();
    final day5Str = _fmt(today.subtract(const Duration(days: 5)));
    final day6Str = _fmt(today.subtract(const Duration(days: 6)));
    final day7Str = _fmt(today.subtract(const Duration(days: 7)));

    // Build readiness rows
    final pipeNames = <String>{};
    for (final e in [...c2Entries, ...ftEntries]) {
      final m = e as Map<String, dynamic>;
      pipeNames.add(m['pipeConfig']?['name'] ?? 'Config #${m['pipeConfigId']}');
    }
    String entryDate(Map<String, dynamic> e) => (e['entryDate'] as String? ?? '').split('T').first;
    final readiness = (pipeNames.toList()..sort()).map((name) {
      bool byName(Map<String, dynamic> e) =>
          (e['pipeConfig']?['name'] ?? 'Config #${e['pipeConfigId']}') == name;
      int sumExact(List src, String d) => src.cast<Map<String, dynamic>>()
          .where((e) => byName(e) && entryDate(e) == d)
          .fold(0, (s, e) => s + ((e['pipesCompleted'] as num?)?.toInt() ?? 0));
      int sumDay7plus(List src) => src.cast<Map<String, dynamic>>()
          .where((e) => byName(e) && entryDate(e).compareTo(day7Str) <= 0)
          .fold(0, (s, e) => s + ((e['pipesCompleted'] as num?)?.toInt() ?? 0));
      int sumAll(List src) => src.cast<Map<String, dynamic>>()
          .where(byName).fold(0, (s, e) => s + ((e['pipesCompleted'] as num?)?.toInt() ?? 0));
      return _ReadinessRow(
        pipeName: name,
        day5: sumExact(c2Entries, day5Str),
        day6: sumExact(c2Entries, day6Str),
        day7plus: sumDay7plus(c2Entries),
        finalTesting: sumAll(ftEntries),
      );
    }).toList();

    // Build customer→address map from sales orders
    final custAddrMap = <String, List<String>>{};
    final seenAddrs   = <String>{};
    final allAddrs    = <String>[];
    for (final so in salesOrders.cast<Map<String, dynamic>>()) {
      final parts = [so['shippingAddress'], so['shippingCity'], so['shippingState']]
          .whereType<String>().where((s) => s.isNotEmpty).toList();
      if (parts.isEmpty) continue;
      final full = parts.join(', ');
      if (seenAddrs.add(full)) allAddrs.add(full);
      final custName = ((so['customer']?['name'] ?? so['customerName'] ?? '') as String).trim().toLowerCase();
      if (custName.isNotEmpty) {
        custAddrMap.putIfAbsent(custName, () => []);
        if (!custAddrMap[custName]!.contains(full)) custAddrMap[custName]!.add(full);
      }
    }
    // Also collect addresses from past loading records
    for (final rec in records.cast<Map<String, dynamic>>()) {
      final a = (rec['siteAddress'] as String? ?? '').trim();
      if (a.isNotEmpty && seenAddrs.add(a)) allAddrs.add(a);
    }
    allAddrs.sort();

    setState(() {
      _rows    = readiness;
      _records = records.cast<Map<String, dynamic>>();
      _vendorNames = vendors.cast<Map<String, dynamic>>()
          .map((v) => (v['name'] ?? v['companyName'] ?? '') as String)
          .where((s) => s.isNotEmpty).toList()..sort();
      _customerNames = customers.cast<Map<String, dynamic>>()
          .map((c) => (c['name'] ?? c['companyName'] ?? '') as String)
          .where((s) => s.isNotEmpty).toList()..sort();
      _allAddresses      = allAddrs;
      _customerAddressMap = custAddrMap;
      _loadingData       = false;
    });
  }

  void _openLoadSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LoadPipesSheet(
        accentColor: _color,
        rows: _rows,
        vendorNames: _vendorNames,
        customerNames: _customerNames,
        allAddresses: _allAddresses,
        customerAddressMap: _customerAddressMap,
        onSubmit: (data) async {
          await ApiService().createLoadingRecord(data);
          await _loadAll();
        },
      ),
    );
  }

  void _openChallanSheet(Map<String, dynamic> rec) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ChallanSheet(record: rec, onSaved: (updated) {
        setState(() {
          final idx = _records.indexWhere((r) => r['id'] == updated['id']);
          if (idx >= 0) _records[idx] = {..._records[idx], ...updated};
        });
      }),
    );
  }

  Widget _badge(int n, Color bg, Color fg) {
    if (n == 0) return const Text('—', style: TextStyle(color: Colors.grey, fontSize: 13));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text('$n', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
    );
  }

  List<Map<String, dynamic>> get _filteredRecords {
    if (_recSearch.trim().isEmpty) return _records;
    final q = _recSearch.toLowerCase();
    return _records.where((r) =>
      (r['pipeName']     ?? '').toString().toLowerCase().contains(q) ||
      (r['vehicleNo']    ?? '').toString().toLowerCase().contains(q) ||
      (r['driverName']   ?? '').toString().toLowerCase().contains(q) ||
      (r['vendor']       ?? '').toString().toLowerCase().contains(q) ||
      (r['customerName'] ?? '').toString().toLowerCase().contains(q) ||
      (r['customerPoNo'] ?? '').toString().toLowerCase().contains(q)
    ).toList();
  }

  @override
  Widget build(BuildContext context) {
    final today     = DateTime.now();
    final day5Label = DateFormat('dd/MM').format(today.subtract(const Duration(days: 5)));
    final day6Label = DateFormat('dd/MM').format(today.subtract(const Duration(days: 6)));
    final day7Label = DateFormat('dd/MM').format(today.subtract(const Duration(days: 7)));

    final totalDay5  = _rows.fold(0, (s, r) => s + r.day5);
    final totalDay6  = _rows.fold(0, (s, r) => s + r.day6);
    final totalDay7  = _rows.fold(0, (s, r) => s + r.day7plus);
    final totalFinal = _rows.fold(0, (s, r) => s + r.finalTesting);

    final filtered     = _filteredRecords;
    final totalLoaded  = filtered.fold(0, (s, r) => s + ((r['quantity'] as num?)?.toInt() ?? 0));
    final uniquePipes   = filtered.map((r) => r['pipeName']).whereType<String>().toSet().length;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: const Text('Loading'),
        backgroundColor: _violet,
        foregroundColor: Colors.white,
        actions: [
          TextButton.icon(
            onPressed: () => setState(() => _showHistory = !_showHistory),
            icon: Icon(_showHistory ? Icons.list_alt : Icons.history, color: Colors.white, size: 18),
            label: Text(_showHistory ? 'Curing Days' : 'Loaded Pipes', style: const TextStyle(color: Colors.white, fontSize: 12)),
          ),
        ],
      ),
      body: _loadingData
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAll,
              child: CustomScrollView(slivers: [
                // Stats strip
                SliverToBoxAdapter(child: _showHistory
                  ? _StatStrip(
                      stats: [
                        ('Dispatches', filtered.length, _violet),
                        ('Pipes Loaded', totalLoaded, _color),
                        ('Pipe Types', uniquePipes, const Color(0xFF2563EB)),
                      ],
                      color: _violet,
                    )
                  : _StatStrip(
                      stats: [
                        ('Day 5 ($day5Label)', totalDay5, Colors.cyan),
                        ('Day 6 ($day6Label)', totalDay6, Colors.blue),
                        ('Day 7+ (≤$day7Label)', totalDay7, Colors.indigo),
                        ('Final Testing', totalFinal, Colors.green),
                      ],
                      color: _violet,
                    ),
                ),

                if (!_showHistory) ...[
                  // Readiness table header
                  SliverToBoxAdapter(child: Container(
                    color: Colors.grey.shade100,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Row(children: [
                      const Expanded(flex: 3, child: Text('Pipe', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.grey))),
                      _thCell('Day 5', day5Label),
                      _thCell('Day 6', day6Label),
                      _thCell('Day 7+', '≤$day7Label'),
                      _thCell('Final', 'Testing'),
                    ]),
                  )),
                  if (_rows.isEmpty)
                    const SliverFillRemaining(child: Center(child: Text('No production data for range')))
                  else
                    SliverList(delegate: SliverChildBuilderDelegate((_, i) {
                      final r = _rows[i];
                      return Container(
                        decoration: BoxDecoration(
                          color: i.isOdd ? Colors.grey.shade50 : Colors.white,
                          border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        child: Row(children: [
                          Expanded(flex: 3, child: Text(r.pipeName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                          Expanded(child: Center(child: _badge(r.day5,         const Color(0xFFECFEFF), const Color(0xFF0E7490)))),
                          Expanded(child: Center(child: _badge(r.day6,         const Color(0xFFEFF6FF), const Color(0xFF1D4ED8)))),
                          Expanded(child: Center(child: _badge(r.day7plus,     const Color(0xFFEEF2FF), const Color(0xFF4338CA)))),
                          Expanded(child: Center(child: _badge(r.finalTesting, const Color(0xFFF0FDF4), const Color(0xFF15803D)))),
                        ]),
                      );
                    }, childCount: _rows.length)),
                  SliverToBoxAdapter(child: Container(
                    color: const Color(0xFFEDE9FE),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(children: [
                      const Expanded(flex: 3, child: Text('Total', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF5B21B6)))),
                      Expanded(child: Center(child: Text('$totalDay5',  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF5B21B6))))),
                      Expanded(child: Center(child: Text('$totalDay6',  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF5B21B6))))),
                      Expanded(child: Center(child: Text('$totalDay7',  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF5B21B6))))),
                      Expanded(child: Center(child: Text('$totalFinal', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF5B21B6))))),
                    ]),
                  )),
                ] else ...[
                  // Search bar
                  SliverToBoxAdapter(child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
                    child: TextField(
                      onChanged: (v) => setState(() => _recSearch = v),
                      decoration: InputDecoration(
                        hintText: 'Search pipe, vehicle, driver, customer…',
                        prefixIcon: const Icon(Icons.search, size: 18),
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade300)),
                        filled: true, fillColor: Colors.white,
                      ),
                    ),
                  )),
                  // Loaded pipes list
                  if (filtered.isEmpty)
                    const SliverFillRemaining(child: Center(child: Text('No loading records found')))
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                      sliver: SliverList(delegate: SliverChildBuilderDelegate((_, i) {
                        final rec = filtered[i];
                        final date    = rec['date'] != null ? _fmtDate(rec['date'] as String) : '—';
                        final qty     = (rec['quantity'] as num?)?.toInt() ?? 0;
                        final rate    = rec['transportRate'];
                        final rateType = rec['rateType'] ?? 'per_pipe';
                        final chNo    = (rec['customerPoNo'] ?? '').toString();
                        final custName = (rec['customerName'] ?? '').toString();
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: Colors.grey.shade200)),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(10),
                            onTap: () => _openChallanSheet(rec),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  Expanded(child: Text(rec['pipeName'] ?? '—', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(12)),
                                    child: Text('$qty pipes', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF15803D))),
                                  ),
                                ]),
                                if (chNo.isNotEmpty || custName.isNotEmpty) Padding(
                                  padding: const EdgeInsets.only(top: 4, bottom: 2),
                                  child: Row(children: [
                                    if (chNo.isNotEmpty) ...[
                                      const Icon(Icons.receipt_outlined, size: 11, color: Color(0xFF7C3AED)),
                                      const SizedBox(width: 3),
                                      Text('CH: $chNo', style: const TextStyle(fontSize: 11, color: Color(0xFF7C3AED), fontWeight: FontWeight.w600)),
                                      const SizedBox(width: 12),
                                    ],
                                    if (custName.isNotEmpty) ...[
                                      const Icon(Icons.person_outline, size: 11, color: Colors.blueGrey),
                                      const SizedBox(width: 3),
                                      Expanded(child: Text(custName, style: const TextStyle(fontSize: 11, color: Colors.blueGrey), overflow: TextOverflow.ellipsis)),
                                    ],
                                  ]),
                                ),
                                const SizedBox(height: 4),
                                Wrap(spacing: 12, runSpacing: 2, children: [
                                  _infoChip(Icons.calendar_today_outlined, date),
                                  if ((rec['vehicleNo'] ?? '').toString().isNotEmpty)  _infoChip(Icons.local_shipping_outlined, rec['vehicleNo'] as String),
                                  if ((rec['driverName'] ?? '').toString().isNotEmpty) _infoChip(Icons.person_outline, rec['driverName'] as String),
                                  if ((rec['vendor'] ?? '').toString().isNotEmpty)     _infoChip(Icons.business_outlined, rec['vendor'] as String),
                                  if ((rec['siteAddress'] ?? '').toString().isNotEmpty) _infoChip(Icons.location_on_outlined, rec['siteAddress'] as String),
                                  if (rate != null && rate.toString().isNotEmpty && rate != '0')
                                    _infoChip(Icons.currency_rupee, '$rate${rateType == "per_trip" ? "/trip" : "/pipe"}'),
                                ]),
                                if ((rec['notes'] ?? '').toString().isNotEmpty) Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(rec['notes'] as String, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                ),
                                Align(
                                  alignment: Alignment.bottomRight,
                                  child: Text('Tap to view challan', style: TextStyle(fontSize: 9, color: Colors.grey.shade400)),
                                ),
                              ]),
                            ),
                          ),
                        );
                      }, childCount: filtered.length)),
                    ),
                ],
              ]),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openLoadSheet,
        backgroundColor: _violet,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_box_outlined),
        label: const Text('Load Pipes'),
      ),
    );
  }

  Widget _thCell(String line1, String line2) => Expanded(child: Column(children: [
    Text(line1, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.grey)),
    Text(line2, style: const TextStyle(fontSize: 8, color: Colors.grey)),
  ]));

  Widget _infoChip(IconData icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
    Icon(icon, size: 11, color: Colors.grey),
    const SizedBox(width: 3),
    Text(text, style: const TextStyle(fontSize: 11, color: Colors.grey)),
  ]);
}

// ── Delivery Challan bottom sheet ─────────────────────────────────────────────

class _ChallanSheet extends StatefulWidget {
  final Map<String, dynamic> record;
  final void Function(Map<String, dynamic>) onSaved;
  const _ChallanSheet({required this.record, required this.onSaved});
  @override
  State<_ChallanSheet> createState() => _ChallanSheetState();
}

class _ChallanSheetState extends State<_ChallanSheet> {
  late TextEditingController _chNoCtrl;
  late TextEditingController _pipeNoCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _chNoCtrl   = TextEditingController(text: widget.record['customerPoNo'] ?? '');
    _pipeNoCtrl = TextEditingController(text: widget.record['pipeNo']       ?? '');
  }

  @override
  void dispose() { _chNoCtrl.dispose(); _pipeNoCtrl.dispose(); super.dispose(); }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final updated = await ApiService().updateLoadingRecord(
        widget.record['id'] as int,
        {...widget.record, 'customerPoNo': _chNoCtrl.text.trim(), 'pipeNo': _pipeNoCtrl.text.trim()},
      );
      widget.onSaved(updated);
      if (mounted) { Navigator.pop(context); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Challan saved'))); }
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final rec      = widget.record;
    final qty      = (rec['quantity'] as num?)?.toInt() ?? 0;
    final date     = rec['date'] != null ? _fmtDate(rec['date'] as String) : '—';
    final bottom   = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      padding: EdgeInsets.only(left: 20, right: 20, top: 16, bottom: bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.receipt_long_outlined, color: Color(0xFF7C3AED), size: 20),
          const SizedBox(width: 8),
          Expanded(child: Text('Delivery Challan', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold))),
          IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
        ]),
        // Record summary
        Container(
          margin: const EdgeInsets.symmetric(vertical: 10),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: const Color(0xFFF9FAFB), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(rec['pipeName'] ?? '—', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            const SizedBox(height: 4),
            Wrap(spacing: 16, children: [
              _summaryItem(Icons.layers_outlined, '$qty pipes'),
              _summaryItem(Icons.calendar_today_outlined, date),
              if ((rec['vehicleNo'] ?? '').toString().isNotEmpty) _summaryItem(Icons.local_shipping_outlined, rec['vehicleNo'] as String),
              if ((rec['customerName'] ?? '').toString().isNotEmpty) _summaryItem(Icons.person_outline, rec['customerName'] as String),
              if ((rec['siteAddress'] ?? '').toString().isNotEmpty) _summaryItem(Icons.location_on_outlined, rec['siteAddress'] as String),
            ]),
          ]),
        ),
        // Editable fields
        TextField(
          controller: _chNoCtrl,
          decoration: const InputDecoration(
            labelText: 'CH.NO (Customer PO No.)',
            hintText: 'e.g. DC-2024-001',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.tag_outlined),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _pipeNoCtrl,
          decoration: const InputDecoration(
            labelText: 'Pipe Number',
            hintText: 'e.g. P-101, P-102',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.numbers_outlined),
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF7C3AED), padding: const EdgeInsets.symmetric(vertical: 14)),
            icon: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.save_outlined),
            label: Text(_saving ? 'Saving…' : 'Save Challan'),
          ),
        ),
      ]),
    );
  }

  Widget _summaryItem(IconData icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
    Icon(icon, size: 12, color: Colors.grey),
    const SizedBox(width: 4),
    Text(text, style: const TextStyle(fontSize: 12, color: Colors.grey)),
  ]);
}

class _StatStrip extends StatelessWidget {
  final List<(String, int, Color)> stats;
  final Color color;
  const _StatStrip({required this.stats, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color,
      child: Row(children: stats.map((s) => Expanded(child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Column(children: [
          Text('${s.$2}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
          Text(s.$1, style: const TextStyle(fontSize: 9, color: Colors.white70), textAlign: TextAlign.center),
        ]),
      ))).toList()),
    );
  }
}

class _LoadPipesSheet extends StatefulWidget {
  final Color accentColor;
  final List<_ReadinessRow> rows;
  final List<String> vendorNames;
  final List<String> customerNames;
  final List<String> allAddresses;
  final Map<String, List<String>> customerAddressMap;
  final Future<void> Function(Map<String, dynamic>) onSubmit;
  const _LoadPipesSheet({
    required this.accentColor,
    required this.rows,
    required this.vendorNames,
    required this.customerNames,
    required this.allAddresses,
    required this.customerAddressMap,
    required this.onSubmit,
  });

  @override
  State<_LoadPipesSheet> createState() => _LoadPipesSheetState();
}

class _LoadPipesSheetState extends State<_LoadPipesSheet> {
  String _pipeName     = '';
  int    _qty          = 0;
  DateTime _date       = DateTime.now();
  String _vendor       = '';
  String _customerName = '';
  String _siteAddress  = '';
  String _transportRate = '';
  String _rateType     = 'per_pipe';
  final _pipeNoCtrl    = TextEditingController();
  final _vehicleCtrl   = TextEditingController();
  final _driverCtrl    = TextEditingController();
  final _contactCtrl   = TextEditingController();
  final _notesCtrl     = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _pipeNoCtrl.dispose(); _vehicleCtrl.dispose(); _driverCtrl.dispose();
    _contactCtrl.dispose(); _notesCtrl.dispose();
    super.dispose();
  }

  List<_ReadinessRow> get _availableRows => widget.rows.where((r) => r.finalTesting > 0).toList();
  int get _maxQty => _availableRows
      .firstWhere((r) => r.pipeName == _pipeName,
          orElse: () => const _ReadinessRow(pipeName: '', day5: 0, day6: 0, day7plus: 0, finalTesting: 0))
      .finalTesting;

  List<String> get _filteredAddresses {
    final sel = _customerName.trim().toLowerCase();
    if (sel.isEmpty) return widget.allAddresses;
    final exact = widget.customerAddressMap[sel];
    if (exact != null && exact.isNotEmpty) return exact;
    final partialKey = widget.customerAddressMap.keys
        .firstWhere((k) => k.contains(sel) || sel.contains(k), orElse: () => '');
    return partialKey.isNotEmpty ? (widget.customerAddressMap[partialKey] ?? widget.allAddresses) : widget.allAddresses;
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: now,
      lastDate: DateTime(now.year + 2),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (_pipeName.isEmpty) { _snack('Please select a pipe type'); return; }
    if (_qty <= 0) { _snack('Please enter a quantity'); return; }
    if (_maxQty > 0 && _qty > _maxQty) { _snack('Exceeds available qty ($_maxQty)'); return; }
    setState(() => _saving = true);
    try {
      await widget.onSubmit({
        'pipeName':      _pipeName,
        'quantity':      _qty,
        'pipeNo':        _pipeNoCtrl.text.trim().isEmpty  ? null : _pipeNoCtrl.text.trim(),
        'date':          DateFormat('yyyy-MM-dd').format(_date),
        'vehicleNo':     _vehicleCtrl.text.trim().isEmpty ? null : _vehicleCtrl.text.trim(),
        'driverName':    _driverCtrl.text.trim().isEmpty  ? null : _driverCtrl.text.trim(),
        'driverContact': _contactCtrl.text.trim().isEmpty ? null : _contactCtrl.text.trim(),
        'vendor':        _vendor.isEmpty       ? null : _vendor,
        'customerName':  _customerName.isEmpty ? null : _customerName,
        'siteAddress':   _siteAddress.isEmpty  ? null : _siteAddress,
        'transportRate': _transportRate.isEmpty ? null : _transportRate,
        'rateType':      _rateType,
        'notes':         _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) _snack('Error: $e');
    }
  }

  void _snack(String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  Widget _sectionLabel(String label) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(children: [
      Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: widget.accentColor, letterSpacing: 1)),
      const SizedBox(width: 8),
      Expanded(child: Container(height: 1, color: Colors.grey.shade200)),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final over   = _maxQty > 0 && _qty > _maxQty;
    final rate   = double.tryParse(_transportRate) ?? 0;
    final total  = _rateType == 'per_pipe' ? (_qty * rate) : rate;

    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 16, bottom: bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Expanded(child: Text('Load Pipes', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
            // Date in header
            GestureDetector(
              onTap: _pickDate,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF7C3AED)),
                const SizedBox(width: 4),
                Text(DateFormat('dd MMM yy').format(_date),
                    style: const TextStyle(fontSize: 13, color: Color(0xFF7C3AED), fontWeight: FontWeight.w600)),
                const Icon(Icons.arrow_drop_down, size: 16, color: Color(0xFF7C3AED)),
              ]),
            ),
            const SizedBox(width: 8),
            IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
          ]),
          Flexible(child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 8),

            // ── Pipe Details ──
            _sectionLabel('PIPE DETAILS'),

            const Text('Pipe Name *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 6),
            Container(
              decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _pipeName.isEmpty ? null : _pipeName,
                  hint: const Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('Select pipe type…', style: TextStyle(color: Colors.grey))),
                  isExpanded: true,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  borderRadius: BorderRadius.circular(10),
                  items: _availableRows.map((r) => DropdownMenuItem(
                    value: r.pipeName,
                    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Text(r.pipeName, style: const TextStyle(fontSize: 14)),
                      Text('${r.finalTesting} avail.', style: const TextStyle(fontSize: 12, color: Colors.green, fontWeight: FontWeight.w600)),
                    ]),
                  )).toList(),
                  onChanged: (v) => setState(() { _pipeName = v ?? ''; _qty = 0; }),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Qty stepper + Pipe No in one row
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Qty
              SizedBox(width: 130, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Quantity *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: over ? Colors.red : Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(children: [
                    IconButton(constraints: const BoxConstraints(minWidth: 32, minHeight: 36), padding: EdgeInsets.zero,
                        icon: const Icon(Icons.remove, size: 16), onPressed: _qty > 0 ? () => setState(() => _qty--) : null),
                    Expanded(child: Text('$_qty', textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
                    IconButton(constraints: const BoxConstraints(minWidth: 32, minHeight: 36), padding: EdgeInsets.zero,
                        icon: const Icon(Icons.add, size: 16), onPressed: () => setState(() => _qty++)),
                  ]),
                ),
                if (over) const Text('Exceeds available', style: TextStyle(fontSize: 10, color: Colors.red))
                else if (_maxQty > 0 && _pipeName.isNotEmpty) Text('Max $_maxQty', style: const TextStyle(fontSize: 10, color: Colors.grey)),
              ])),
              const SizedBox(width: 12),
              // Pipe No
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Pipe Number', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
                const SizedBox(height: 6),
                TextField(
                  controller: _pipeNoCtrl,
                  decoration: InputDecoration(
                    hintText: 'e.g. P-101',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                ),
              ])),
            ]),
            const SizedBox(height: 16),

            // ── Transport ──
            _sectionLabel('TRANSPORT'),
            const Text('Vendor / Transporter', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 6),
            _AutocompleteField(value: _vendor, onChanged: (v) => setState(() => _vendor = v), suggestions: widget.vendorNames, placeholder: 'Search vendor…'),
            const SizedBox(height: 12),

            Row(children: [
              const Expanded(child: Text('Transport Rate', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey))),
              _RateTypeToggle(value: _rateType, onChanged: (v) => setState(() => _rateType = v)),
            ]),
            const SizedBox(height: 6),
            TextField(
              decoration: const InputDecoration(prefixText: '₹ ', labelText: 'Rate', border: OutlineInputBorder()),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: (v) => setState(() => _transportRate = v),
            ),
            if (rate > 0 && _qty > 0) Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                _rateType == 'per_pipe'
                    ? '$_qty pipes × ₹$rate = ₹${NumberFormat('#,##0.00', 'en_IN').format(total)}'
                    : 'Trip total = ₹${NumberFormat('#,##0.00', 'en_IN').format(total)}',
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
            ),
            const SizedBox(height: 16),

            // ── Vehicle & Driver ──
            _sectionLabel('VEHICLE & DRIVER'),
            TextField(controller: _vehicleCtrl, decoration: const InputDecoration(labelText: 'Vehicle Number', border: OutlineInputBorder(), hintText: 'MH 12 AB 1234')),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: _driverCtrl, decoration: const InputDecoration(labelText: 'Driver Name', border: OutlineInputBorder()))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: _contactCtrl, decoration: const InputDecoration(labelText: 'Driver Contact', border: OutlineInputBorder()), keyboardType: TextInputType.phone)),
            ]),
            const SizedBox(height: 16),

            // ── Delivery ──
            _sectionLabel('DELIVERY'),
            const Text('Customer Name', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 6),
            _AutocompleteField(
              value: _customerName,
              onChanged: (v) => setState(() { _customerName = v; _siteAddress = ''; }),
              suggestions: widget.customerNames,
              placeholder: 'Search customer…',
            ),
            const SizedBox(height: 12),
            const Text('Site / Shipping Address', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 6),
            _AutocompleteField(
              value: _siteAddress,
              onChanged: (v) => setState(() => _siteAddress = v),
              suggestions: _filteredAddresses,
              placeholder: 'Search or type address…',
            ),
            const SizedBox(height: 12),
            TextField(controller: _notesCtrl, decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder()), maxLines: 2),
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(backgroundColor: widget.accentColor, padding: const EdgeInsets.symmetric(vertical: 14)),
                icon: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.check_circle_outline),
                label: Text(_saving ? 'Saving…' : 'Confirm Load'),
              ),
            ),
          ]))),
        ]),
      ),
    );
  }
}

class _AutocompleteField extends StatefulWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final List<String> suggestions;
  final String placeholder;
  const _AutocompleteField({required this.value, required this.onChanged, required this.suggestions, required this.placeholder});

  @override
  State<_AutocompleteField> createState() => _AutocompleteFieldState();
}

class _AutocompleteFieldState extends State<_AutocompleteField> {
  late TextEditingController _ctrl;
  bool _showList = false;

  @override
  void initState() { super.initState(); _ctrl = TextEditingController(text: widget.value); }
  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  List<String> get _filtered {
    final q = _ctrl.text.trim().toLowerCase();
    return q.isEmpty ? widget.suggestions : widget.suggestions.where((s) => s.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      TextField(
        controller: _ctrl,
        decoration: InputDecoration(labelText: widget.placeholder, border: const OutlineInputBorder()),
        onChanged: (v) { setState(() => _showList = true); widget.onChanged(v); },
        onTap: () => setState(() => _showList = true),
      ),
      if (_showList && _filtered.isNotEmpty)
        Container(
          margin: const EdgeInsets.only(top: 2),
          constraints: const BoxConstraints(maxHeight: 140),
          decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(8), color: Colors.white,
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.07), blurRadius: 8)]),
          child: ListView(shrinkWrap: true, children: _filtered.map((s) => ListTile(
            dense: true,
            title: Text(s, style: const TextStyle(fontSize: 13)),
            onTap: () { _ctrl.text = s; widget.onChanged(s); setState(() => _showList = false); },
          )).toList()),
        ),
    ]);
  }
}

class _RateTypeToggle extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  const _RateTypeToggle({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(8)),
      child: Row(mainAxisSize: MainAxisSize.min, children: ['per_pipe', 'per_trip'].map((t) {
        final sel = t == value;
        return GestureDetector(
          onTap: () => onChanged(t),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: sel ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(6),
                boxShadow: sel ? [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 4)] : null),
            child: Text(t == 'per_pipe' ? '₹/Pipe' : '₹/Trip',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: sel ? const Color(0xFF7C3AED) : Colors.grey)),
          ),
        );
      }).toList()),
    );
  }
}

// ── Extra Vehicles ────────────────────────────────────────────────────────────

const _vehicleKeys = ['crane', 'jcb', 'tractor', 'excavator', 'tipper', 'selfLoader', 'generator', 'transitMixer'];
const _vehicleLabels = {
  'crane': 'Crane', 'jcb': 'JCB', 'tractor': 'Tractor', 'excavator': 'Excavator',
  'tipper': 'Tipper', 'selfLoader': 'Self Loader', 'generator': 'Generator', 'transitMixer': 'Transit Mixer',
};

class _VehicleItem {
  bool enabled;
  String rateType; // 'per_day' | 'per_hour'
  double quantity;
  double rate;
  _VehicleItem({this.enabled = false, this.rateType = 'per_day', this.quantity = 0, this.rate = 0});

  factory _VehicleItem.fromJson(Map<String, dynamic> j) => _VehicleItem(
        enabled: j['enabled'] == true,
        rateType: j['rateType'] ?? 'per_day',
        quantity: (j['quantity'] as num?)?.toDouble() ?? 0,
        rate: (j['rate'] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toJson() => {'enabled': enabled, 'rateType': rateType, 'quantity': quantity, 'rate': rate};
  double get amount => enabled ? quantity * rate : 0;
}

class _ExtraVehicleEntry {
  final int id;
  final String date;
  final String vendor;
  final Map<String, _VehicleItem> vehicles;
  final String? notes;
  _ExtraVehicleEntry({required this.id, required this.date, required this.vendor, required this.vehicles, this.notes});

  factory _ExtraVehicleEntry.fromJson(Map<String, dynamic> j) {
    final rawVehicles = j['vehicles'];
    final vehicleMap = rawVehicles is String ? jsonDecode(rawVehicles) as Map<String, dynamic> : (rawVehicles as Map<String, dynamic>? ?? {});
    return _ExtraVehicleEntry(
      id: j['id'] as int,
      date: j['date'] ?? '',
      vendor: j['vendor'] ?? '',
      vehicles: {for (final k in _vehicleKeys) k: _VehicleItem.fromJson((vehicleMap[k] as Map<String, dynamic>?) ?? {})},
      notes: j['notes'],
    );
  }

  double get totalAmount => _vehicleKeys.fold(0, (s, k) => s + (vehicles[k]?.amount ?? 0));
  List<String> get activeKeys => _vehicleKeys.where((k) => vehicles[k]?.enabled == true).toList();
}

Map<String, _VehicleItem> _emptyVehicleMap() => {for (final k in _vehicleKeys) k: _VehicleItem()};

class ExtraVehiclesScreen extends StatefulWidget {
  const ExtraVehiclesScreen({super.key});
  @override
  State<ExtraVehiclesScreen> createState() => _ExtraVehiclesScreenState();
}

class _ExtraVehiclesScreenState extends State<ExtraVehiclesScreen> {
  static const _color = Color(0xFFC026D3);
  List<_ExtraVehicleEntry> _items = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getExtraVehicles(size: 200);
      setState(() {
        _items = raw.map((e) => _ExtraVehicleEntry.fromJson(e as Map<String, dynamic>)).toList();
        _loading = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  List<String> get _vendorSuggestions {
    final seen = <String>{};
    return _items.map((e) => e.vendor).where((v) => v.isNotEmpty && seen.add(v)).toList()..sort();
  }

  Future<void> _showAddEdit(BuildContext context, {_ExtraVehicleEntry? editing}) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ExtraVehicleSheet(
        accentColor: _color,
        initial: editing,
        vendorSuggestions: _vendorSuggestions,
        onSubmit: (data) async {
          if (editing != null) {
            await ApiService().updateExtraVehicle(editing.id, data);
          } else {
            await ApiService().createExtraVehicle(data);
          }
          await _load();
        },
      ),
    );
  }

  Future<void> _delete(_ExtraVehicleEntry entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Entry'),
        content: Text('Delete entry for ${_fmtDate(entry.date)} — ${entry.vendor}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ApiService().deleteExtraVehicle(entry.id);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: const Text('Extra Vehicles'),
        backgroundColor: _color,
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? const Center(child: Text('No extra vehicle entries'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _items.length,
                      itemBuilder: (_, i) => _ExtraVehicleCard(
                        entry: _items[i],
                        color: _color,
                        onEdit: () => _showAddEdit(context, editing: _items[i]),
                        onDelete: () => _delete(_items[i]),
                      ),
                    ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddEdit(context),
        backgroundColor: _color,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _ExtraVehicleCard extends StatelessWidget {
  final _ExtraVehicleEntry entry;
  final Color color;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _ExtraVehicleCard({required this.entry, required this.color, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final active = entry.activeKeys;
    final fmt = NumberFormat('#,##0.00', 'en_IN');
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.withOpacity(0.15)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                child: Icon(Icons.directions_car_outlined, color: color, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(entry.vendor, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                Text(_fmtDate(entry.date), style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ])),
              Text('₹${fmt.format(entry.totalAmount)}',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: color)),
              const SizedBox(width: 4),
              IconButton(icon: const Icon(Icons.edit_outlined, size: 18), color: Colors.grey, onPressed: onEdit, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
              const SizedBox(width: 4),
              IconButton(icon: const Icon(Icons.delete_outline, size: 18), color: Colors.red[300], onPressed: onDelete, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
            ]),
            if (active.isNotEmpty) ...[
              const SizedBox(height: 8),
              const Divider(height: 1),
              const SizedBox(height: 8),
              ...active.map((k) {
                final v = entry.vehicles[k]!;
                final rateLabel = v.rateType == 'per_day' ? 'day' : 'hr';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(20)),
                      child: Text(_vehicleLabels[k] ?? k, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
                    ),
                    const SizedBox(width: 8),
                    Text('${v.quantity % 1 == 0 ? v.quantity.toInt() : v.quantity} / $rateLabel',
                        style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    const Spacer(),
                    Text('₹${fmt.format(v.amount)}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ]),
                );
              }),
            ],
            if (entry.notes != null && entry.notes!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(entry.notes!, style: const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ],
        ),
      ),
    );
  }
}

class _ExtraVehicleSheet extends StatefulWidget {
  final Color accentColor;
  final _ExtraVehicleEntry? initial;
  final List<String> vendorSuggestions;
  final Future<void> Function(Map<String, dynamic>) onSubmit;
  const _ExtraVehicleSheet({required this.accentColor, this.initial, required this.vendorSuggestions, required this.onSubmit});

  @override
  State<_ExtraVehicleSheet> createState() => _ExtraVehicleSheetState();
}

class _ExtraVehicleSheetState extends State<_ExtraVehicleSheet> {
  late DateTime _date;
  late TextEditingController _vendorCtrl;
  late TextEditingController _notesCtrl;
  late Map<String, _VehicleItem> _vehicles;
  bool _saving = false;
  bool _showSuggestions = false;

  final Map<String, TextEditingController> _qtyCtrl = {};
  final Map<String, TextEditingController> _rateCtrl = {};

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    _date = init != null ? DateTime.tryParse(init.date) ?? DateTime.now() : DateTime.now();
    _vendorCtrl = TextEditingController(text: init?.vendor ?? '');
    _notesCtrl = TextEditingController(text: init?.notes ?? '');
    _vehicles = init != null
        ? {for (final k in _vehicleKeys) k: _VehicleItem(enabled: init.vehicles[k]?.enabled ?? false, rateType: init.vehicles[k]?.rateType ?? 'per_day', quantity: init.vehicles[k]?.quantity ?? 0, rate: init.vehicles[k]?.rate ?? 0)}
        : _emptyVehicleMap();
    for (final k in _vehicleKeys) {
      final v = _vehicles[k]!;
      _qtyCtrl[k] = TextEditingController(text: v.quantity > 0 ? (v.quantity % 1 == 0 ? v.quantity.toInt().toString() : v.quantity.toString()) : '');
      _rateCtrl[k] = TextEditingController(text: v.rate > 0 ? v.rate.toStringAsFixed(2) : '');
    }
  }

  @override
  void dispose() {
    _vendorCtrl.dispose(); _notesCtrl.dispose();
    for (final c in _qtyCtrl.values) c.dispose();
    for (final c in _rateCtrl.values) c.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime(2030));
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (_vendorCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a vendor name')));
      return;
    }
    final anyEnabled = _vehicleKeys.any((k) => _vehicles[k]!.enabled);
    if (!anyEnabled) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enable at least one vehicle')));
      return;
    }
    // sync text controllers to model
    for (final k in _vehicleKeys) {
      _vehicles[k]!.quantity = double.tryParse(_qtyCtrl[k]!.text.trim()) ?? 0;
      _vehicles[k]!.rate = double.tryParse(_rateCtrl[k]!.text.trim()) ?? 0;
    }
    setState(() => _saving = true);
    try {
      final vehicleJson = {for (final k in _vehicleKeys) k: _vehicles[k]!.toJson()};
      await widget.onSubmit({
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'vendor': _vendorCtrl.text.trim(),
        'vehicles': jsonEncode(vehicleJson),
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  List<String> get _filteredSuggestions {
    final q = _vendorCtrl.text.trim().toLowerCase();
    final all = widget.vendorSuggestions;
    return q.isEmpty ? all : all.where((s) => s.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text(widget.initial != null ? 'Edit Entry' : 'Add Extra Vehicles',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
              IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
            ]),
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 12),
                    // Date
                    GestureDetector(
                      onTap: _pickDate,
                      child: InputDecorator(
                        decoration: const InputDecoration(labelText: 'Date *', border: OutlineInputBorder(), suffixIcon: Icon(Icons.calendar_today_outlined)),
                        child: Text(DateFormat('dd MMM yyyy').format(_date)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Vendor with autocomplete
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      TextField(
                        controller: _vendorCtrl,
                        decoration: const InputDecoration(labelText: 'Vendor *', border: OutlineInputBorder()),
                        onChanged: (_) => setState(() => _showSuggestions = true),
                        onTap: () => setState(() => _showSuggestions = true),
                      ),
                      if (_showSuggestions && _filteredSuggestions.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.only(top: 2),
                          decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(8), color: Colors.white,
                              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 8)]),
                          constraints: const BoxConstraints(maxHeight: 150),
                          child: ListView(shrinkWrap: true, children: _filteredSuggestions.map((s) => ListTile(
                            dense: true, title: Text(s, style: const TextStyle(fontSize: 13)),
                            onTap: () { _vendorCtrl.text = s; setState(() => _showSuggestions = false); },
                          )).toList()),
                        ),
                    ]),
                    const SizedBox(height: 16),
                    const Text('Vehicles', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey)),
                    const SizedBox(height: 8),
                    // Vehicle rows
                    ..._vehicleKeys.map((k) {
                      final v = _vehicles[k]!;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: v.enabled ? widget.accentColor.withOpacity(0.04) : Colors.grey.shade50,
                          border: Border.all(color: v.enabled ? widget.accentColor.withOpacity(0.3) : Colors.grey.shade200),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Column(children: [
                          // Toggle row
                          InkWell(
                            borderRadius: BorderRadius.circular(10),
                            onTap: () => setState(() => v.enabled = !v.enabled),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              child: Row(children: [
                                Switch(value: v.enabled, onChanged: (val) => setState(() => v.enabled = val), activeColor: widget.accentColor, materialTapTargetSize: MaterialTapTargetSize.shrinkWrap),
                                const SizedBox(width: 8),
                                Text(_vehicleLabels[k] ?? k, style: TextStyle(fontWeight: FontWeight.w600, color: v.enabled ? Colors.black87 : Colors.grey)),
                                const Spacer(),
                                if (v.enabled)
                                  Builder(builder: (_) {
                                    final qty = double.tryParse(_qtyCtrl[k]!.text) ?? 0;
                                    final rate = double.tryParse(_rateCtrl[k]!.text) ?? 0;
                                    final amt = qty * rate;
                                    return amt > 0
                                        ? Text('₹${NumberFormat('#,##0.00', 'en_IN').format(amt)}',
                                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: widget.accentColor))
                                        : const SizedBox();
                                  }),
                              ]),
                            ),
                          ),
                          // Fields (when enabled)
                          if (v.enabled) Padding(
                            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                            child: Row(children: [
                              // Rate type
                              Expanded(flex: 2, child: DropdownButtonFormField<String>(
                                value: v.rateType,
                                decoration: const InputDecoration(labelText: 'Rate Type', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10)),
                                items: const [
                                  DropdownMenuItem(value: 'per_day', child: Text('Per Day', style: TextStyle(fontSize: 13))),
                                  DropdownMenuItem(value: 'per_hour', child: Text('Per Hour', style: TextStyle(fontSize: 13))),
                                ],
                                onChanged: (val) => setState(() => v.rateType = val ?? 'per_day'),
                              )),
                              const SizedBox(width: 8),
                              // Quantity
                              Expanded(child: TextField(
                                controller: _qtyCtrl[k],
                                decoration: const InputDecoration(labelText: 'Qty', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10)),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                onChanged: (_) => setState(() {}),
                              )),
                              const SizedBox(width: 8),
                              // Rate
                              Expanded(child: TextField(
                                controller: _rateCtrl[k],
                                decoration: const InputDecoration(labelText: 'Rate ₹', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10)),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                onChanged: (_) => setState(() {}),
                              )),
                            ]),
                          ),
                        ]),
                      );
                    }),
                    const SizedBox(height: 4),
                    // Notes
                    TextField(
                      controller: _notesCtrl,
                      decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder()),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _saving ? null : _submit,
                        style: FilledButton.styleFrom(backgroundColor: widget.accentColor),
                        child: _saving
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : Text(widget.initial != null ? 'Save Changes' : 'Add Entry'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Conversion ────────────────────────────────────────────────────────────────

class _ConversionEntry {
  final int id;
  final String date;
  final String fromPipe;
  final String toPipe;
  final String quantity;
  final String? notes;
  _ConversionEntry({required this.id, required this.date, required this.fromPipe, required this.toPipe, required this.quantity, this.notes});

  factory _ConversionEntry.fromJson(Map<String, dynamic> j) => _ConversionEntry(
        id: j['id'] as int, date: j['date'] ?? '', fromPipe: j['fromPipe'] ?? '',
        toPipe: j['toPipe'] ?? '', quantity: j['quantity']?.toString() ?? '0', notes: j['notes'],
      );

  static RegExp _pipeRe = RegExp(r'(\d+)mm\s+([\d.]+)kg', caseSensitive: false);

  Map<String, String>? get fromParsed { final m = _pipeRe.firstMatch(fromPipe); return m != null ? {'d': m[1]!, 'kg': m[2]!} : null; }
  Map<String, String>? get toParsed   { final m = _pipeRe.firstMatch(toPipe);   return m != null ? {'d': m[1]!, 'kg': m[2]!} : null; }
}

class ConversionScreen extends StatefulWidget {
  const ConversionScreen({super.key});
  @override
  State<ConversionScreen> createState() => _ConversionScreenState();
}

class _ConversionScreenState extends State<ConversionScreen> {
  static const _color = Color(0xFF9333EA);
  List<_ConversionEntry> _items = [];
  bool _loading = true;
  // pipe configs: diameter → sorted list of kg strings
  Map<String, List<String>> _pipesByDiameter = {};
  List<String> _diameters = [];
  bool _loadingPipes = true;

  @override
  void initState() { super.initState(); _loadAll(); }

  Future<void> _loadAll() async {
    await Future.wait([_load(), _loadPipes()]);
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getConversions();
      setState(() {
        _items = raw.map((e) => _ConversionEntry.fromJson(e as Map<String, dynamic>)).toList();
        _loading = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  Future<void> _loadPipes() async {
    setState(() => _loadingPipes = true);
    try {
      final raw = await ApiService().getPipeConfigs();
      final re = RegExp(r'(\d+)mm\s+([\d.]+)kg', caseSensitive: false);
      final map = <String, List<String>>{};
      for (final p in raw) {
        final name = (p as Map<String, dynamic>)['name']?.toString() ?? '';
        final m = re.firstMatch(name);
        if (m == null) continue;
        final d = m[1]!, kg = m[2]!;
        map.putIfAbsent(d, () => []);
        if (!map[d]!.contains(kg)) map[d]!.add(kg);
      }
      for (final list in map.values) list.sort((a, b) => double.parse(a).compareTo(double.parse(b)));
      final diams = map.keys.toList()..sort((a, b) => int.parse(a).compareTo(int.parse(b)));
      setState(() { _pipesByDiameter = map; _diameters = diams; _loadingPipes = false; });
    } catch (_) { setState(() => _loadingPipes = false); }
  }

  Future<void> _showAddEdit({_ConversionEntry? editing}) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ConversionSheet(
        accentColor: _color,
        initial: editing,
        pipesByDiameter: _pipesByDiameter,
        diameters: _diameters,
        loadingPipes: _loadingPipes,
        onSubmit: (data) async {
          if (editing != null) {
            await ApiService().updateConversion(editing.id, data);
          } else {
            await ApiService().createConversion(data);
          }
          await _load();
        },
      ),
    );
  }

  Future<void> _delete(_ConversionEntry entry) async {
    final fp = entry.fromParsed;
    final tp = entry.toParsed;
    final desc = fp != null && tp != null
        ? '${fp['d']}mm ${fp['kg']}kg → ${tp['kg']}kg'
        : '${entry.fromPipe} → ${entry.toPipe}';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Conversion'),
        content: Text('Delete $desc on ${_fmtDate(entry.date)}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirmed == true) { await ApiService().deleteConversion(entry.id); _load(); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(title: const Text('Conversion'), backgroundColor: _color, foregroundColor: Colors.white),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAll,
              child: _items.isEmpty
                  ? const Center(child: Text('No conversion entries'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _items.length,
                      itemBuilder: (_, i) => _ConversionCard(entry: _items[i], color: _color,
                          onEdit: () => _showAddEdit(editing: _items[i]),
                          onDelete: () => _delete(_items[i])),
                    ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddEdit(),
        backgroundColor: _color,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _ConversionCard extends StatelessWidget {
  final _ConversionEntry entry;
  final Color color;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _ConversionCard({required this.entry, required this.color, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final fp = entry.fromParsed;
    final tp = entry.toParsed;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.withOpacity(0.15))),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
            child: Icon(Icons.sync_outlined, color: color, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              if (fp != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(20)),
                  child: Text('${fp['d']} mm · ${fp['kg']} kg', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.orange.shade700)),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Icon(Icons.arrow_forward, size: 14, color: color),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(20)),
                  child: Text('${tp?['kg'] ?? ''} kg', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
                ),
              ] else
                Text('${entry.fromPipe} → ${entry.toPipe}', style: const TextStyle(fontSize: 12)),
              const Spacer(),
              Text('${double.tryParse(entry.quantity)?.toInt() ?? entry.quantity} pipes',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 2),
            Text(_fmtDate(entry.date), style: const TextStyle(fontSize: 11, color: Colors.grey)),
            if (entry.notes != null && entry.notes!.isNotEmpty)
              Text(entry.notes!, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ])),
          IconButton(icon: const Icon(Icons.edit_outlined, size: 18), color: Colors.grey, onPressed: onEdit, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
          const SizedBox(width: 4),
          IconButton(icon: const Icon(Icons.delete_outline, size: 18), color: Colors.red[300], onPressed: onDelete, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
        ]),
      ),
    );
  }
}

class _ConversionSheet extends StatefulWidget {
  final Color accentColor;
  final _ConversionEntry? initial;
  final Map<String, List<String>> pipesByDiameter;
  final List<String> diameters;
  final bool loadingPipes;
  final Future<void> Function(Map<String, dynamic>) onSubmit;
  const _ConversionSheet({required this.accentColor, this.initial, required this.pipesByDiameter, required this.diameters, required this.loadingPipes, required this.onSubmit});

  @override
  State<_ConversionSheet> createState() => _ConversionSheetState();
}

class _ConversionSheetState extends State<_ConversionSheet> {
  late DateTime _date;
  late String _diameter;
  late String _fromKg;
  late String _toKg;
  late TextEditingController _qtyCtrl;
  late TextEditingController _notesCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    _date = init != null ? (DateTime.tryParse(init.date) ?? DateTime.now()) : DateTime.now();
    _diameter = init?.fromParsed?['d'] ?? (widget.diameters.isNotEmpty ? widget.diameters.first : '');
    _fromKg = init?.fromParsed?['kg'] ?? '';
    _toKg = init?.toParsed?['kg'] ?? '';
    _qtyCtrl = TextEditingController(text: init?.quantity ?? '');
    _notesCtrl = TextEditingController(text: init?.notes ?? '');
  }

  @override
  void dispose() { _qtyCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime(2030));
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (_diameter.isEmpty) { _snack('Please select a diameter'); return; }
    if (_fromKg.isEmpty) { _snack('Please select source pressure'); return; }
    if (_toKg.isEmpty) { _snack('Please select target pressure'); return; }
    if (_fromKg == _toKg) { _snack('From and To pressures must be different'); return; }
    final qty = double.tryParse(_qtyCtrl.text.trim()) ?? 0;
    if (qty <= 0) { _snack('Please enter a valid quantity'); return; }

    setState(() => _saving = true);
    try {
      await widget.onSubmit({
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'fromPipe': 'PCCP ${_diameter}mm ${_fromKg}kg',
        'toPipe': 'PCCP ${_diameter}mm ${_toKg}kg',
        'quantity': _qtyCtrl.text.trim(),
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) _snack('Error: $e');
    }
  }

  void _snack(String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  List<String> get _kgOptions => widget.pipesByDiameter[_diameter] ?? [];

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(widget.initial != null ? 'Edit Conversion' : 'New Conversion',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
            IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
          ]),
          Flexible(child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 12),

            // Date
            GestureDetector(
              onTap: _pickDate,
              child: InputDecorator(
                decoration: const InputDecoration(labelText: 'Date *', border: OutlineInputBorder(), suffixIcon: Icon(Icons.calendar_today_outlined)),
                child: Text(DateFormat('dd MMM yyyy').format(_date)),
              ),
            ),
            const SizedBox(height: 16),

            // Diameter chips
            const Text('Diameter *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 8),
            widget.loadingPipes
                ? const Text('Loading pipe configs…', style: TextStyle(fontSize: 12, color: Colors.grey))
                : widget.diameters.isEmpty
                    ? const Text('No pipe configs found', style: TextStyle(fontSize: 12, color: Colors.grey))
                    : Wrap(spacing: 8, runSpacing: 8, children: widget.diameters.map((d) {
                        final selected = d == _diameter;
                        return GestureDetector(
                          onTap: () => setState(() { _diameter = d; _fromKg = ''; _toKg = ''; }),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: selected ? widget.accentColor : Colors.white,
                              border: Border.all(color: selected ? widget.accentColor : Colors.grey.shade300),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text('$d mm', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? Colors.white : Colors.grey.shade700)),
                          ),
                        );
                      }).toList()),
            const SizedBox(height: 16),

            // From → To pressure dropdowns
            const Text('Pressure Conversion *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 8),
            Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
              Expanded(child: DropdownButtonFormField<String>(
                value: _fromKg.isEmpty ? null : _fromKg,
                decoration: const InputDecoration(labelText: 'From pressure', border: OutlineInputBorder()),
                items: _kgOptions.where((k) => k != _toKg).map((k) => DropdownMenuItem(value: k, child: Text('$k kg'))).toList(),
                onChanged: _diameter.isEmpty ? null : (v) => setState(() => _fromKg = v ?? ''),
                hint: const Text('From…'),
              )),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Icon(Icons.arrow_forward, color: widget.accentColor, size: 18),
              ),
              Expanded(child: DropdownButtonFormField<String>(
                value: _toKg.isEmpty ? null : _toKg,
                decoration: const InputDecoration(labelText: 'To pressure', border: OutlineInputBorder()),
                items: _kgOptions.where((k) => k != _fromKg).map((k) => DropdownMenuItem(value: k, child: Text('$k kg'))).toList(),
                onChanged: _diameter.isEmpty ? null : (v) => setState(() => _toKg = v ?? ''),
                hint: const Text('To…'),
              )),
            ]),

            // Live preview
            if (_diameter.isNotEmpty && _fromKg.isNotEmpty && _toKg.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: widget.accentColor.withOpacity(0.05), borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: widget.accentColor.withOpacity(0.2))),
                child: Row(children: [
                  const Text('Converting: ', style: TextStyle(fontSize: 11, color: Colors.grey)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(6)),
                    child: Text('PCCP ${_diameter}mm ${_fromKg}kg', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.orange.shade700)),
                  ),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 6), child: Icon(Icons.arrow_forward, size: 12, color: widget.accentColor)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: widget.accentColor.withOpacity(0.08), borderRadius: BorderRadius.circular(6)),
                    child: Text('PCCP ${_diameter}mm ${_toKg}kg', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: widget.accentColor)),
                  ),
                ]),
              ),
            ],
            const SizedBox(height: 16),

            // Quantity
            TextField(
              controller: _qtyCtrl,
              decoration: const InputDecoration(labelText: 'Quantity (pipes) *', border: OutlineInputBorder()),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),

            // Notes
            TextField(
              controller: _notesCtrl,
              decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder()),
              maxLines: 2,
            ),
            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(backgroundColor: widget.accentColor),
                child: _saving
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(widget.initial != null ? 'Save Changes' : 'Add Conversion'),
              ),
            ),
          ]))),
        ]),
      ),
    );
  }
}

// ── Shared Widgets ────────────────────────────────────────────────────────────

class _BizCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final String? notes;

  const _BizCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    this.notes,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.withOpacity(0.15)),
      ),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(subtitle),
            if (notes != null && notes!.isNotEmpty)
              Text(notes!,
                  style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
        isThreeLine: notes != null && notes!.isNotEmpty,
      ),
    );
  }
}

String _fmtDate(String dateStr) {
  try {
    return DateFormat('dd MMM yyyy').format(DateTime.parse(dateStr));
  } catch (_) {
    return dateStr;
  }
}

class _FieldDef {
  final String key;
  final String label;
  final TextInputType type;
  const _FieldDef(this.key, this.label, this.type);
}

class _SimpleAddSheet extends StatefulWidget {
  final String title;
  final Color accentColor;
  final List<_FieldDef> fields;
  final Future<void> Function(Map<String, String>) onSubmit;

  const _SimpleAddSheet({
    required this.title,
    required this.accentColor,
    required this.fields,
    required this.onSubmit,
  });

  @override
  State<_SimpleAddSheet> createState() => _SimpleAddSheetState();
}

class _SimpleAddSheetState extends State<_SimpleAddSheet> {
  late final Map<String, TextEditingController> _controllers;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _controllers = {for (final f in widget.fields) f.key: TextEditingController()};
  }

  @override
  void dispose() {
    for (final c in _controllers.values) c.dispose();
    super.dispose();
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
          Text(widget.title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          ...widget.fields.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextField(
                  controller: _controllers[f.key],
                  decoration: InputDecoration(
                    labelText: f.label,
                    border: const OutlineInputBorder(),
                  ),
                  keyboardType: f.type,
                ),
              )),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _submit,
              style: FilledButton.styleFrom(backgroundColor: widget.accentColor),
              child: _saving
                  ? const SizedBox(
                      height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Save'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await widget.onSubmit(
          {for (final e in _controllers.entries) e.key: e.value.text.trim()});
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}

// ── Loaded Pipes ──────────────────────────────────────────────────────────────

class LoadedPipesScreen extends StatefulWidget {
  const LoadedPipesScreen({super.key});
  @override
  State<LoadedPipesScreen> createState() => _LoadedPipesScreenState();
}

class _LoadedPipesScreenState extends State<LoadedPipesScreen> {
  List<dynamic> _records = [];
  bool _loading = true;
  String _search = '';

  // date range
  DateTime _from = DateTime.now().subtract(const Duration(days: 30));
  DateTime _to   = DateTime.now();

  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  String get _fromStr => DateFormat('yyyy-MM-dd').format(_from);
  String get _toStr   => DateFormat('yyyy-MM-dd').format(_to);

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getLoadingRecords(from: _fromStr, to: _toStr, size: 500);
      if (mounted) setState(() { _records = raw; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> get _filtered {
    if (_search.isEmpty) return _records;
    final q = _search.toLowerCase();
    return _records.where((r) {
      final pipe    = (r['pipeName']      ?? '').toString().toLowerCase();
      final vehicle = (r['vehicleNo']     ?? '').toString().toLowerCase();
      final driver  = (r['driverName']    ?? '').toString().toLowerCase();
      final vendor  = (r['vendorName']    ?? '').toString().toLowerCase();
      final ch      = (r['customerPoNo']  ?? '').toString().toLowerCase();
      return pipe.contains(q) || vehicle.contains(q) ||
             driver.contains(q) || vendor.contains(q) || ch.contains(q);
    }).toList();
  }

  void _applyPreset(String preset) {
    final now = DateTime.now();
    setState(() {
      switch (preset) {
        case 'Today':
          _from = DateTime(now.year, now.month, now.day);
          _to   = now;
          break;
        case 'Last 7d':
          _from = now.subtract(const Duration(days: 7));
          _to   = now;
          break;
        case 'Last 30d':
          _from = now.subtract(const Duration(days: 30));
          _to   = now;
          break;
        case 'This Month':
          _from = DateTime(now.year, now.month, 1);
          _to   = now;
          break;
        case 'This Quarter':
          final q = ((now.month - 1) ~/ 3) * 3 + 1;
          _from = DateTime(now.year, q, 1);
          _to   = now;
          break;
        case 'This Year':
          _from = DateTime(now.year, 1, 1);
          _to   = now;
          break;
      }
    });
    _loadData();
  }

  // stats
  int get _totalDispatches => _filtered.length;
  int get _totalPipes => _filtered.fold(0, (s, r) =>
      s + (int.tryParse(r['quantity']?.toString() ?? '0') ?? 0));
  int get _uniqueTypes => _filtered.map((r) => r['pipeName']?.toString() ?? '').toSet().length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: const Color(0xFF16A34A),
        foregroundColor: Colors.white,
        title: const Text('Loaded Pipes'),
        elevation: 0,
      ),
      body: Column(
        children: [
          _buildPresets(),
          _buildSearchBar(),
          _buildStats(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _filtered.isEmpty
                    ? const Center(child: Text('No records found', style: TextStyle(color: Colors.grey)))
                    : RefreshIndicator(
                        onRefresh: _loadData,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _filtered.length,
                          itemBuilder: (ctx, i) => _RecordCard(
                            record: _filtered[i],
                            onUpdated: _loadData,
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildPresets() {
    const presets = ['Today', 'Last 7d', 'Last 30d', 'This Month', 'This Quarter', 'This Year'];
    return Container(
      color: Colors.white,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: presets.map((p) => Padding(
            padding: const EdgeInsets.only(right: 6),
            child: ActionChip(
              label: Text(p, style: const TextStyle(fontSize: 12)),
              backgroundColor: const Color(0xFF16A34A),
              labelStyle: const TextStyle(color: Colors.white),
              onPressed: () => _applyPreset(p),
            ),
          )).toList(),
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: TextField(
        controller: _searchCtrl,
        decoration: InputDecoration(
          hintText: 'Search pipe, vehicle, driver, vendor, CH.NO…',
          prefixIcon: const Icon(Icons.search, size: 18),
          suffixIcon: _search.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: () { _searchCtrl.clear(); setState(() => _search = ''); },
                )
              : null,
          isDense: true,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        ),
        onChanged: (v) => setState(() => _search = v),
      ),
    );
  }

  Widget _buildStats() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      margin: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          _StatChip(label: 'Dispatches', value: '$_totalDispatches', color: const Color(0xFF16A34A)),
          const SizedBox(width: 8),
          _StatChip(label: 'Pipes Loaded', value: '$_totalPipes', color: const Color(0xFF2563EB)),
          const SizedBox(width: 8),
          _StatChip(label: 'Pipe Types', value: '$_uniqueTypes', color: const Color(0xFF7C3AED)),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatChip({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 16)),
          Text(label, style: TextStyle(fontSize: 11, color: color.withOpacity(0.8))),
        ],
      ),
    );
  }
}

// ── Record Card ───────────────────────────────────────────────────────────────

class _RecordCard extends StatelessWidget {
  final Map<String, dynamic> record;
  final VoidCallback onUpdated;
  const _RecordCard({required this.record, required this.onUpdated});

  @override
  Widget build(BuildContext context) {
    final date      = _fmtDate(record['date']?.toString() ?? record['createdAt']?.toString() ?? '');
    final pipeName  = record['pipeName']?.toString() ?? '—';
    final qty       = record['quantity']?.toString() ?? '0';
    final vehicleNo = record['vehicleNo']?.toString() ?? '—';
    final driver    = record['driverName']?.toString() ?? '—';
    final contact   = record['driverContact']?.toString() ?? '';
    final vendor    = record['vendorName']?.toString() ?? record['vendor']?.toString() ?? '—';
    final chNo      = record['customerPoNo']?.toString() ?? '';
    final hasPhoto  = record['challanPhotoUrl'] != null && (record['challanPhotoUrl'] as String).isNotEmpty;
    final id        = record['id'] is int ? record['id'] as int : int.tryParse(record['id']?.toString() ?? '') ?? 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16A34A).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(date, style: const TextStyle(fontSize: 11, color: Color(0xFF16A34A), fontWeight: FontWeight.w600)),
                ),
                const Spacer(),
                if (chNo.isNotEmpty)
                  Text('CH: $chNo', style: const TextStyle(fontSize: 11, color: Colors.grey)),
              ],
            ),
            const SizedBox(height: 8),
            Text(pipeName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            _InfoRow(Icons.numbers, 'Qty: $qty pipes'),
            _InfoRow(Icons.local_shipping_outlined, '$vehicleNo · $driver${contact.isNotEmpty ? ' · $contact' : ''}'),
            if (vendor != '—') _InfoRow(Icons.business_outlined, vendor),
            const SizedBox(height: 10),
            Row(
              children: [
                _ActionBtn(
                  icon: Icons.receipt_long_outlined,
                  label: 'Delivery Challan',
                  color: const Color(0xFF2563EB),
                  onTap: () => showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => _DeliveryChallanSheet(record: record, onSaved: onUpdated),
                  ),
                ),
                const SizedBox(width: 8),
                _ActionBtn(
                  icon: hasPhoto ? Icons.photo_outlined : Icons.upload_outlined,
                  label: hasPhoto ? 'View Photo' : 'Add Photo',
                  color: hasPhoto ? const Color(0xFF7C3AED) : const Color(0xFF64748B),
                  onTap: () => _handlePhoto(context, id, hasPhoto, record['challanPhotoUrl']?.toString()),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handlePhoto(BuildContext context, int id, bool hasPhoto, String? url) async {
    if (hasPhoto && url != null && url.isNotEmpty) {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.black,
        builder: (_) => _PhotoLightbox(url: url, id: id, onDeleted: onUpdated),
      );
    } else {
      await _uploadPhoto(context, id);
    }
  }

  Future<void> _uploadPhoto(BuildContext context, int id) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    try {
      await ApiService().uploadChallanPhoto(id, bytes, picked.name);
      onUpdated();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Photo uploaded')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    }
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoRow(this.icon, this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: Row(
        children: [
          Icon(icon, size: 13, color: Colors.grey),
          const SizedBox(width: 4),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 12, color: Color(0xFF374151)))),
        ],
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionBtn({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: color.withOpacity(0.08),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: color.withOpacity(0.2)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 15, color: color),
              const SizedBox(width: 4),
              Text(label, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Photo Lightbox ────────────────────────────────────────────────────────────

class _PhotoLightbox extends StatelessWidget {
  final String url;
  final int id;
  final VoidCallback onDeleted;
  const _PhotoLightbox({required this.url, required this.id, required this.onDeleted});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
                const Spacer(),
                TextButton.icon(
                  icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                  label: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
                  onPressed: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (_) => AlertDialog(
                        title: const Text('Delete photo?'),
                        content: const Text('This action cannot be undone.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
                        ],
                      ),
                    );
                    if (ok != true) return;
                    try {
                      await ApiService().deleteChallanPhoto(id);
                      onDeleted();
                      if (context.mounted) Navigator.pop(context);
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
                      }
                    }
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: InteractiveViewer(
              child: Center(
                child: Image.network(
                  url,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.white, size: 64),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Delivery Challan Sheet ────────────────────────────────────────────────────

class _DeliveryChallanSheet extends StatefulWidget {
  final Map<String, dynamic> record;
  final VoidCallback onSaved;
  const _DeliveryChallanSheet({required this.record, required this.onSaved});

  @override
  State<_DeliveryChallanSheet> createState() => _DeliveryChallanSheetState();
}

class _DeliveryChallanSheetState extends State<_DeliveryChallanSheet> {
  late TextEditingController _chNoCtrl;
  late TextEditingController _pipeNoCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _chNoCtrl   = TextEditingController(text: widget.record['customerPoNo']?.toString() ?? '');
    _pipeNoCtrl = TextEditingController(text: widget.record['pipeNo']?.toString() ?? '');
  }

  @override
  void dispose() {
    _chNoCtrl.dispose();
    _pipeNoCtrl.dispose();
    super.dispose();
  }

  int get _id => widget.record['id'] is int
      ? widget.record['id'] as int
      : int.tryParse(widget.record['id']?.toString() ?? '') ?? 0;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ApiService().updateLoadingRecord(_id, {
        'customerPoNo': _chNoCtrl.text.trim(),
        'pipeNo':       _pipeNoCtrl.text.trim(),
      });
      widget.onSaved();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.record;
    final date    = _fmtDate(r['date']?.toString() ?? r['createdAt']?.toString() ?? '');
    final pipe    = r['pipeName']?.toString()    ?? '—';
    final qty     = r['quantity']?.toString()    ?? '0';
    final vehicle = r['vehicleNo']?.toString()   ?? '—';
    final driver  = r['driverName']?.toString()  ?? '—';
    final contact = r['driverContact']?.toString() ?? '';
    final vendor  = r['vendorName']?.toString()  ?? r['vendor']?.toString() ?? '—';
    final site    = r['siteAddress']?.toString() ?? '—';

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      maxChildSize: 0.97,
      minChildSize: 0.5,
      builder: (_, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // handle
            Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              width: 40, height: 4,
              decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
            ),
            // header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long_outlined, color: Color(0xFF2563EB)),
                  const SizedBox(width: 8),
                  const Text('Delivery Challan', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                controller: scrollCtrl,
                padding: const EdgeInsets.all(16),
                children: [
                  // Editable fields
                  const Text('Edit Challan Details', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF6B7280))),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _chNoCtrl,
                          decoration: InputDecoration(
                            labelText: 'CH. No.',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            isDense: true,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _pipeNoCtrl,
                          decoration: InputDecoration(
                            labelText: 'Pipe No.',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            isDense: true,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: _saving
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save_outlined, size: 16),
                      label: Text(_saving ? 'Saving…' : 'Save Changes'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  // Preview challan
                  const Text('Preview', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF6B7280))),
                  const SizedBox(height: 10),
                  _ChallanPreview(
                    chNo:    _chNoCtrl.text.trim().isNotEmpty ? _chNoCtrl.text : '—',
                    pipeNo:  _pipeNoCtrl.text.trim().isNotEmpty ? _pipeNoCtrl.text : '—',
                    date:    date,
                    pipe:    pipe,
                    qty:     qty,
                    vehicle: vehicle,
                    driver:  driver,
                    contact: contact,
                    vendor:  vendor,
                    site:    site,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Challan Preview Card ──────────────────────────────────────────────────────

class _ChallanPreview extends StatelessWidget {
  final String chNo, pipeNo, date, pipe, qty, vehicle, driver, contact, vendor, site;
  const _ChallanPreview({
    required this.chNo, required this.pipeNo, required this.date,
    required this.pipe, required this.qty, required this.vehicle,
    required this.driver, required this.contact, required this.vendor, required this.site,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFF2563EB), width: 1.5),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(
              color: Color(0xFF2563EB),
              borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Text('PP PIPES PRODUCTS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('DELIVERY CHALLAN', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)),
                    Text('CH. No: $chNo', style: const TextStyle(color: Colors.white70, fontSize: 10)),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                _ChallanRow('Date', date),
                _ChallanRow('Pipe No.', pipeNo),
                _ChallanRow('Pipe Name', pipe),
                _ChallanRow('Quantity', '$qty pipes'),
                _ChallanRow('Vehicle No.', vehicle),
                _ChallanRow('Driver', '$driver${contact.isNotEmpty ? ' ($contact)' : ''}'),
                if (vendor != '—') _ChallanRow('Vendor', vendor),
                if (site != '—') _ChallanRow('Site Address', site),
              ],
            ),
          ),
          Container(
            height: 1,
            color: const Color(0xFFE5E7EB),
            margin: const EdgeInsets.symmetric(horizontal: 12),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('Authorised Signatory', style: TextStyle(fontSize: 10, color: Colors.grey)),
                SizedBox(height: 24),
                Divider(thickness: 1),
                SizedBox(height: 2),
                Text('PP Pipes Products', style: TextStyle(fontSize: 10, color: Colors.grey)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChallanRow extends StatelessWidget {
  final String label;
  final String value;
  const _ChallanRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          ),
          const Text(': ', style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

// ── PDI ───────────────────────────────────────────────────────────────────────

const _pdiChecks = [
  ('finishing',     'Finishing'),
  ('colour',        'Colour'),
  ('numbering',     'Numbering'),
  ('ghola',         'Ghola'),
  ('qualityCheck',  'Quality Check'),
  ('diameterCheck', 'Diameter Check'),
];

class PdiScreen extends StatefulWidget {
  const PdiScreen({super.key});
  @override
  State<PdiScreen> createState() => _PdiScreenState();
}

class _PdiScreenState extends State<PdiScreen> {
  static const _emerald = Color(0xFF059669);
  static const _violet  = Color(0xFF7C3AED);

  bool _loading = true;
  List<Map<String, dynamic>> _entries = [];
  List<Map<String, dynamic>> _pipeOptions = [];   // {pipeName, available}
  List<String> _allThirdPartyOptions = [];

  late DateTime _from;
  late DateTime _to;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _loadAll();
  }

  String _fmt(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService().getPdiEntries(from: _fmt(_from), to: _fmt(_to)),
        ApiService().getProductionEntries(stageType: 'FINAL_TESTING', size: 500),
        ApiService().getPdiEntries(size: 2000),   // all entries for party name list
      ]);
      final entries      = results[0];
      final ftEntries    = results[1];
      final allEntries   = results[2];

      // Group final testing by pipe name and sum pipesCompleted
      final map = <String, int>{};
      for (final e in ftEntries.cast<Map<String, dynamic>>()) {
        final name = (e['pipeConfig']?['name'] ?? 'Config #${e['pipeConfigId']}') as String;
        map[name] = (map[name] ?? 0) + ((e['pipesCompleted'] as num?)?.toInt() ?? 0);
      }
      final pipeOpts = map.entries.map((e) => {'pipeName': e.key, 'available': e.value}).toList()
        ..sort((a, b) => (a['pipeName'] as String).compareTo(b['pipeName'] as String));

      // Unique third party names from ALL historical PDI entries
      final seen = <String>{};
      final partyNames = allEntries
          .cast<Map<String, dynamic>>()
          .map((e) => (e['thirdParty'] ?? '').toString().trim())
          .where((s) => s.isNotEmpty && seen.add(s))
          .toList()..sort();

      setState(() {
        _entries             = entries.cast<Map<String, dynamic>>();
        _pipeOptions         = pipeOpts;
        _allThirdPartyOptions = partyNames;
        _loading             = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  int _passCount(Map<String, dynamic> e) =>
      _pdiChecks.where((c) => e[c.$1] == true).length;

  List<Map<String, dynamic>> get _filtered {
    if (_search.trim().isEmpty) return _entries;
    final q = _search.toLowerCase();
    return _entries.where((e) =>
      (e['pipeName']   ?? '').toString().toLowerCase().contains(q) ||
      (e['thirdParty'] ?? '').toString().toLowerCase().contains(q)
    ).toList();
  }


  void _openAdd() {
    showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (_) => _PdiSheet(
        pipeOptions: _pipeOptions,
        thirdPartyOptions: _allThirdPartyOptions,
        accentColor: _emerald,
        onSave: (rows) async {
          final created = await Future.wait(rows.map((r) => ApiService().createPdiEntry(r)));
          setState(() => _entries = [...created.reversed.toList(), ..._entries]);
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(created.length > 1 ? '${created.length} PDI entries added' : 'PDI entry added')));
        },
      ),
    );
  }

  void _openEdit(Map<String, dynamic> entry) {
    showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (_) => _PdiSheet(
        initial: entry,
        pipeOptions: _pipeOptions,
        thirdPartyOptions: _allThirdPartyOptions,
        accentColor: _emerald,
        onSave: (rows) async {
          final updated = await ApiService().updatePdiEntry(entry['id'] as int, rows.first);
          setState(() => _entries = _entries.map((e) => e['id'] == updated['id'] ? updated : e).toList());
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Entry updated')));
        },
      ),
    );
  }

  void _confirmDelete(Map<String, dynamic> entry) {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Delete PDI Entry'),
      content: Text('Delete PDI entry for ${entry['pipeName']} on ${_fmtDate(entry['date'] as String? ?? '')}?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(
          onPressed: () async {
            Navigator.pop(ctx);
            try {
              await ApiService().deletePdiEntry(entry['id'] as int);
              setState(() => _entries = _entries.where((e) => e['id'] != entry['id']).toList());
              if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Entry deleted')));
            } catch (e) {
              if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
            }
          },
          style: FilledButton.styleFrom(backgroundColor: Colors.red),
          child: const Text('Delete'),
        ),
      ],
    ));
  }

  @override
  Widget build(BuildContext context) {
    final filtered    = _filtered;
    final totalQty    = filtered.fold(0.0, (s, e) => s + (double.tryParse(e['quantity']?.toString() ?? '') ?? 0));
    final avgPassed   = filtered.isEmpty ? 0.0 : filtered.fold(0, (s, e) => s + _passCount(e)) / filtered.length;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: const Text('PDI'),
        backgroundColor: _violet,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: Colors.white),
            onPressed: _openAdd,
            tooltip: 'Add Entry',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAll,
              child: CustomScrollView(slivers: [
                // Stats strip
                SliverToBoxAdapter(child: Container(
                  color: _violet,
                  child: Row(children: [
                    _stat('${filtered.length}', 'Total Entries'),
                    _stat(totalQty.toStringAsFixed(0), 'Pipes Inspected'),
                    _stat(filtered.isEmpty ? '—' : avgPassed.toStringAsFixed(1), 'Avg Checks\n(of ${_pdiChecks.length})'),
                  ]),
                )),

                // Date range bar
                SliverToBoxAdapter(child: Container(
                  color: _violet.withOpacity(0.06),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(children: [
                    const Icon(Icons.date_range_outlined, size: 14, color: Color(0xFF7C3AED)),
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: () async {
                        final r = await showDateRangePicker(context: context,
                          firstDate: DateTime(2023), lastDate: DateTime(2030),
                          initialDateRange: DateTimeRange(start: _from, end: _to),
                          builder: (ctx, child) => Theme(data: Theme.of(ctx).copyWith(
                            colorScheme: const ColorScheme.light(primary: Color(0xFF7C3AED))), child: child!));
                        if (r != null) { setState(() { _from = r.start; _to = r.end; }); _loadAll(); }
                      },
                      child: Text(
                        '${DateFormat('dd MMM yy').format(_from)} – ${DateFormat('dd MMM yy').format(_to)}',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF7C3AED), fontWeight: FontWeight.w600),
                      ),
                    ),
                    const Spacer(),
                    // Quick presets
                    for (final p in [('Today', 0), ('7d', 6), ('30d', 29)])
                      GestureDetector(
                        onTap: () {
                          final t = DateTime.now();
                          setState(() { _to = t; _from = t.subtract(Duration(days: p.$2)); });
                          _loadAll();
                        },
                        child: Container(
                          margin: const EdgeInsets.only(left: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(color: const Color(0xFF7C3AED).withOpacity(0.12), borderRadius: BorderRadius.circular(6)),
                          child: Text(p.$1, style: const TextStyle(fontSize: 10, color: Color(0xFF7C3AED), fontWeight: FontWeight.w600)),
                        ),
                      ),
                  ]),
                )),

                // Search bar
                SliverToBoxAdapter(child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
                  child: TextField(
                    onChanged: (v) => setState(() => _search = v),
                    decoration: InputDecoration(
                      hintText: 'Search pipe name or third party…',
                      prefixIcon: const Icon(Icons.search, size: 18),
                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade300)),
                      filled: true, fillColor: Colors.white,
                    ),
                  ),
                )),

                if (filtered.isEmpty)
                  const SliverFillRemaining(child: Center(child: Text('No PDI entries found')))
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 6, 12, 80),
                    sliver: SliverList(delegate: SliverChildBuilderDelegate((_, i) {
                      final e   = filtered[i];
                      final passed = _passCount(e);
                      final date = _fmtDate(e['date'] as String? ?? '');
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            // Header row
                            Row(children: [
                              Expanded(child: Text(e['pipeName'] ?? '—', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: passed == _pdiChecks.length ? const Color(0xFFD1FAE5) : const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text('$passed/${_pdiChecks.length}', style: TextStyle(
                                  fontSize: 11, fontWeight: FontWeight.w700,
                                  color: passed == _pdiChecks.length ? const Color(0xFF065F46) : const Color(0xFF92400E),
                                )),
                              ),
                              const SizedBox(width: 8),
                              IconButton(
                                icon: const Icon(Icons.edit_outlined, size: 16),
                                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                padding: EdgeInsets.zero,
                                onPressed: () => _openEdit(e),
                                color: Colors.grey,
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, size: 16),
                                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                padding: EdgeInsets.zero,
                                onPressed: () => _confirmDelete(e),
                                color: Colors.red.shade300,
                              ),
                            ]),
                            const SizedBox(height: 4),
                            // Sub-info
                            Wrap(spacing: 12, runSpacing: 2, children: [
                              _chip(Icons.calendar_today_outlined, date),
                              _chip(Icons.format_list_numbered_outlined, '${double.tryParse(e['quantity']?.toString() ?? '0')?.toStringAsFixed(0) ?? 0} pipes'),
                              if ((e['thirdParty'] ?? '').toString().isNotEmpty)
                                _chip(Icons.person_outline, e['thirdParty'] as String),
                            ]),
                            // Checks grid
                            const SizedBox(height: 8),
                            Wrap(spacing: 6, runSpacing: 4, children: _pdiChecks.map((c) {
                              final ok = e[c.$1] == true;
                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: ok ? const Color(0xFFD1FAE5) : Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Icon(ok ? Icons.check_circle_outline : Icons.remove_circle_outline,
                                      size: 11, color: ok ? _emerald : Colors.grey.shade400),
                                  const SizedBox(width: 4),
                                  Text(c.$2, style: TextStyle(
                                    fontSize: 10, fontWeight: FontWeight.w600,
                                    color: ok ? const Color(0xFF065F46) : Colors.grey.shade400,
                                  )),
                                ]),
                              );
                            }).toList()),
                            if ((e['notes'] ?? '').toString().isNotEmpty) Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(e['notes'] as String, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                            ),
                          ]),
                        ),
                      );
                    }, childCount: filtered.length)),
                  ),
              ]),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAdd,
        backgroundColor: _emerald,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Add Entry'),
      ),
    );
  }

  Widget _stat(String val, String label) => Expanded(child: Container(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Column(children: [
      Text(val, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70), textAlign: TextAlign.center),
    ]),
  ));

  Widget _chip(IconData icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
    Icon(icon, size: 11, color: Colors.grey),
    const SizedBox(width: 3),
    Text(text, style: const TextStyle(fontSize: 11, color: Colors.grey)),
  ]);
}

// ── PDI Add/Edit Sheet ────────────────────────────────────────────────────────

class _PdiSheet extends StatefulWidget {
  final Map<String, dynamic>? initial;
  final List<Map<String, dynamic>> pipeOptions;
  final List<String> thirdPartyOptions;
  final Color accentColor;
  final Future<void> Function(List<Map<String, dynamic>>) onSave;

  const _PdiSheet({this.initial, required this.pipeOptions, required this.thirdPartyOptions, required this.accentColor, required this.onSave});

  @override
  State<_PdiSheet> createState() => _PdiSheetState();
}

class _PdiSheetState extends State<_PdiSheet> {
  bool get _isEdit => widget.initial != null;

  DateTime _date = DateTime.now();
  String _thirdParty = '';
  final _notesCtrl   = TextEditingController();

  // Edit mode fields
  String _pipeName = '';
  final _qtyCtrl   = TextEditingController();

  // Add mode — multi-pipe rows [{pipeName, qty}]
  List<Map<String, dynamic>> _pipeRows = [{'pipeName': '', 'qty': ''}];

  // Inspection checks
  Map<String, bool> _checks = {for (final c in _pdiChecks) c.$1: false};

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    if (init != null) {
      try { _date = DateTime.parse(init['date'] as String? ?? ''); } catch (_) {}
      _thirdParty      = init['thirdParty'] ?? '';
      _pipeName        = init['pipeName']   ?? '';
      _qtyCtrl.text    = init['quantity']?.toString() ?? '';
      _notesCtrl.text  = init['notes']     ?? '';
      for (final c in _pdiChecks) { _checks[c.$1] = init[c.$1] == true; }
    }
  }

  @override
  void dispose() { _notesCtrl.dispose(); _qtyCtrl.dispose(); super.dispose(); }

  int _availableFor(String pipeName) {
    final opt = widget.pipeOptions.firstWhere(
      (o) => o['pipeName'] == pipeName, orElse: () => {});
    return (opt['available'] as int?) ?? 0;
  }

  Future<void> _submit() async {
    if (_thirdParty.trim().isEmpty) { setState(() => _error = 'Third party name is required'); return; }
    if (_isEdit) {
      if (_pipeName.isEmpty) { setState(() => _error = 'Pipe name is required'); return; }
      if (_qtyCtrl.text.isEmpty) { setState(() => _error = 'Quantity is required'); return; }
      final avail = _availableFor(_pipeName);
      final entered = int.tryParse(_qtyCtrl.text) ?? 0;
      if (avail > 0 && entered > avail) {
        setState(() => _error = 'Qty exceeds available ($avail) for $_pipeName'); return;
      }
    } else {
      if (_pipeRows.any((r) => (r['pipeName'] as String).isEmpty || (r['qty'] as String).isEmpty)) {
        setState(() => _error = 'All pipes must have a name and quantity'); return;
      }
      for (final r in _pipeRows) {
        final name   = r['pipeName'] as String;
        final avail  = _availableFor(name);
        final entered = int.tryParse(r['qty'] as String) ?? 0;
        if (avail > 0 && entered > avail) {
          setState(() => _error = 'Qty $entered exceeds available ($avail) for $name'); return;
        }
      }
    }
    setState(() { _saving = true; _error = null; });
    try {
      final base = {
        'date':       DateFormat('yyyy-MM-dd').format(_date),
        'thirdParty': _thirdParty.trim(),
        'notes':      _notesCtrl.text.trim(),
        ..._checks,
      };
      final rows = _isEdit
          ? [{ ...base, 'pipeName': _pipeName, 'quantity': _qtyCtrl.text.trim() }]
          : _pipeRows.map((r) => { ...base, 'pipeName': r['pipeName'], 'quantity': r['qty'] }).toList();
      await widget.onSave(rows);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() { _saving = false; _error = e.toString(); });
    }
  }

  Widget _sectionLabel(String label) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(children: [
      Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: widget.accentColor, letterSpacing: 1)),
      const SizedBox(width: 8),
      Expanded(child: Container(height: 1, color: Colors.grey.shade200)),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final passed = _checks.values.where((v) => v).length;

    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 16, bottom: bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Header
          Row(children: [
            Expanded(child: Text(_isEdit ? 'Edit PDI Entry' : 'Add PDI Entry',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
            // Date picker in header
            GestureDetector(
              onTap: () async {
                final picked = await showDatePicker(context: context, initialDate: _date,
                    firstDate: DateTime(2023), lastDate: DateTime(2030));
                if (picked != null) setState(() => _date = picked);
              },
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF7C3AED)),
                const SizedBox(width: 4),
                Text(DateFormat('dd MMM yy').format(_date),
                    style: const TextStyle(fontSize: 13, color: Color(0xFF7C3AED), fontWeight: FontWeight.w600)),
                const Icon(Icons.arrow_drop_down, size: 16, color: Color(0xFF7C3AED)),
              ]),
            ),
            const SizedBox(width: 4),
            IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
          ]),

          Flexible(child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 8),

            // Third party
            _sectionLabel('INSPECTION DETAILS'),
            _AutocompleteField(
              value: _thirdParty,
              onChanged: (v) => setState(() => _thirdParty = v),
              suggestions: widget.thirdPartyOptions,
              placeholder: 'Third Party Name *',
            ),
            const SizedBox(height: 16),

            // Pipes section
            _sectionLabel('PIPES'),
            if (_isEdit) ...[
              // Single pipe edit
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: _PipeDrop(
                  value: _pipeName,
                  options: widget.pipeOptions,
                  onChanged: (v) => setState(() { _pipeName = v; _qtyCtrl.clear(); }),
                )),
                const SizedBox(width: 12),
                SizedBox(width: 90, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  TextField(
                    controller: _qtyCtrl,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      labelText: 'Qty *',
                      border: const OutlineInputBorder(),
                      errorText: () {
                        final avail = _availableFor(_pipeName);
                        final entered = int.tryParse(_qtyCtrl.text) ?? 0;
                        return avail > 0 && entered > avail ? 'Max $avail' : null;
                      }(),
                    ),
                  ),
                  if (_pipeName.isNotEmpty && _availableFor(_pipeName) > 0)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text('Max ${_availableFor(_pipeName)}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                    ),
                ])),
              ]),
            ] else ...[
              // Multi-pipe rows
              ..._pipeRows.asMap().entries.map((entry) {
                final i   = entry.key;
                final row = entry.value;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${i + 1}', style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w700)),
                    const SizedBox(width: 8),
                    Expanded(child: _PipeDrop(
                      value: row['pipeName'] as String,
                      options: widget.pipeOptions,
                      onChanged: (v) => setState(() => _pipeRows[i] = {...row, 'pipeName': v}),
                    )),
                    const SizedBox(width: 8),
                    SizedBox(width: 70, child: TextFormField(
                      initialValue: row['qty'] as String,
                      keyboardType: TextInputType.number,
                      onChanged: (v) => setState(() => _pipeRows[i] = {...row, 'qty': v}),
                      decoration: const InputDecoration(labelText: 'Qty', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 12)),
                    )),
                    const SizedBox(width: 4),
                    IconButton(
                      icon: const Icon(Icons.close, size: 16),
                      onPressed: _pipeRows.length > 1 ? () => setState(() => _pipeRows.removeAt(i)) : null,
                      color: Colors.red.shade300,
                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                      padding: EdgeInsets.zero,
                    ),
                  ]),
                );
              }),
              TextButton.icon(
                onPressed: () => setState(() => _pipeRows.add({'pipeName': '', 'qty': ''})),
                icon: const Icon(Icons.add_circle_outline, size: 16),
                label: const Text('Add Pipe'),
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF059669)),
              ),
            ],
            const SizedBox(height: 16),

            // Checks
            Row(children: [
              _sectionLabel('INSPECTION CHECKS').let((w) => Expanded(child: w)),
              if (passed > 0) Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(10)),
                child: Text('$passed/${_pdiChecks.length} passed', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF065F46))),
              ),
            ]),
            GridView.count(
              crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 3.8,
              children: _pdiChecks.map((c) {
                final ok = _checks[c.$1] ?? false;
                return GestureDetector(
                  onTap: () => setState(() => _checks[c.$1] = !ok),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: ok ? const Color(0xFFECFDF5) : Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: ok ? const Color(0xFF6EE7B7) : Colors.grey.shade200),
                    ),
                    child: Row(children: [
                      Icon(ok ? Icons.check_circle_outline : Icons.circle_outlined,
                          size: 14, color: ok ? const Color(0xFF059669) : Colors.grey.shade300),
                      const SizedBox(width: 6),
                      Expanded(child: Text(c.$2, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                          color: ok ? const Color(0xFF065F46) : Colors.grey.shade400))),
                    ]),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // Notes
            TextField(
              controller: _notesCtrl,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder()),
            ),

            if (_error != null) Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!, style: const TextStyle(fontSize: 12, color: Colors.red)),
            ),
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(backgroundColor: widget.accentColor, padding: const EdgeInsets.symmetric(vertical: 14)),
                icon: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.check_circle_outline),
                label: Text(_saving ? 'Saving…' : _isEdit ? 'Save Changes' : _pipeRows.length > 1 ? 'Add ${_pipeRows.length} Entries' : 'Add Entry'),
              ),
            ),
          ]))),
        ]),
      ),
    );
  }
}

// ── Pipe dropdown for PDI ─────────────────────────────────────────────────────

class _PipeDrop extends StatelessWidget {
  final String value;
  final List<Map<String, dynamic>> options;
  final ValueChanged<String> onChanged;
  const _PipeDrop({required this.value, required this.options, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value.isEmpty ? null : value,
          hint: const Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('Select pipe…', style: TextStyle(fontSize: 13, color: Colors.grey))),
          isExpanded: true,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          borderRadius: BorderRadius.circular(10),
          items: options.map((o) => DropdownMenuItem<String>(
            value: o['pipeName'] as String,
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Flexible(child: Text(o['pipeName'] as String, style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis)),
              Text('${o['available']} avail.', style: const TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.w600)),
            ]),
          )).toList(),
          onChanged: (v) { if (v != null) onChanged(v); },
        ),
      ),
    );
  }
}

extension _Let<T> on T {
  R let<R>(R Function(T) block) => block(this);
}
