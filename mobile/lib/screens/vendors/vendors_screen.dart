import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';

class VendorsScreen extends StatefulWidget {
  const VendorsScreen({super.key});

  @override
  State<VendorsScreen> createState() => _VendorsScreenState();
}

class _VendorsScreenState extends State<VendorsScreen> {
  final List<Vendor> _vendors = [];
  bool _loading = false;
  bool _hasMore = true;
  int _page = 0;
  final _scroll = ScrollController();
  final _searchCtrl = TextEditingController();
  String _query = '';

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
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    if (reset) {
      _vendors.clear();
      _page = 0;
      _hasMore = true;
    }
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getVendors(page: _page, size: 30);
      final items = raw.map((e) => Vendor.fromJson(e)).toList();
      setState(() {
        _vendors.addAll(items);
        _page++;
        _hasMore = items.length == 30;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  List<Vendor> get _filtered {
    if (_query.isEmpty) return _vendors;
    final q = _query.toLowerCase();
    return _vendors
        .where((v) =>
            v.name.toLowerCase().contains(q) ||
            (v.phone?.contains(q) ?? false) ||
            (v.email?.toLowerCase().contains(q) ?? false))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final filtered = _filtered;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_outlined),
          onPressed: openAppDrawer,
          tooltip: 'Open menu',
        ),
        title: const Text('Vendors'),
        backgroundColor: const Color(0xFF9C27B0),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _load(reset: true),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search vendors...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _query = '');
                        })
                    : null,
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          Expanded(
            child: filtered.isEmpty && !_loading
                ? const Center(child: Text('No vendors found'))
                : RefreshIndicator(
                    onRefresh: () => _load(reset: true),
                    child: ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                      itemCount: filtered.length + (_loading ? 1 : 0),
                      itemBuilder: (ctx, i) {
                        if (i >= filtered.length) {
                          return const Center(
                              child: Padding(
                            padding: EdgeInsets.all(16),
                            child: CircularProgressIndicator(),
                          ));
                        }
                        final vendor = filtered[i];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: BorderSide(color: Colors.grey.withOpacity(0.15)),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(14),
                            onTap: () => _showDetail(context, vendor, fmt),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    backgroundColor:
                                        const Color(0xFF9C27B0).withOpacity(0.12),
                                    child: Text(
                                      vendor.name.isNotEmpty
                                          ? vendor.name[0].toUpperCase()
                                          : 'V',
                                      style: const TextStyle(
                                          color: Color(0xFF9C27B0),
                                          fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(vendor.name,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.bold)),
                                        if (vendor.phone != null)
                                          Text(vendor.phone!,
                                              style: const TextStyle(
                                                  fontSize: 12, color: Colors.grey)),
                                      ],
                                    ),
                                  ),
                                  if (vendor.outstandingPayable != null &&
                                      vendor.outstandingPayable! > 0)
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(fmt.format(vendor.outstandingPayable!),
                                            style: const TextStyle(
                                                fontWeight: FontWeight.bold,
                                                color: Color(0xFFF44336),
                                                fontSize: 12)),
                                        const Text('Payable',
                                            style: TextStyle(
                                                fontSize: 10, color: Colors.grey)),
                                      ],
                                    ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  void _showDetail(BuildContext context, Vendor vendor, NumberFormat fmt) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: const Color(0xFF9C27B0).withOpacity(0.12),
                  child: Text(
                    vendor.name[0].toUpperCase(),
                    style: const TextStyle(
                        fontSize: 22,
                        color: Color(0xFF9C27B0),
                        fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(vendor.name,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold)),
                      if (vendor.email != null)
                        Text(vendor.email!,
                            style: const TextStyle(color: Colors.grey)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (vendor.phone != null)
              _DetailRow(icon: Icons.phone, label: 'Phone', value: vendor.phone!),
            if (vendor.address != null)
              _DetailRow(icon: Icons.location_on, label: 'Address', value: vendor.address!),
            if (vendor.outstandingPayable != null)
              _DetailRow(
                icon: Icons.account_balance_wallet,
                label: 'Outstanding Payable',
                value: fmt.format(vendor.outstandingPayable!),
                valueColor: vendor.outstandingPayable! > 0 ? const Color(0xFFF44336) : null,
              ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _DetailRow(
      {required this.icon,
      required this.label,
      required this.value,
      this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey),
          const SizedBox(width: 10),
          Text('$label: ',
              style: const TextStyle(color: Colors.grey, fontSize: 13)),
          Expanded(
            child: Text(value,
                style: TextStyle(
                    fontWeight: FontWeight.w500,
                    fontSize: 13,
                    color: valueColor)),
          ),
        ],
      ),
    );
  }
}
