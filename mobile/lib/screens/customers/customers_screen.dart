import 'package:flutter/material.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import 'customer_profile_screen.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  final _searchCtrl = TextEditingController();
  List<Customer> _results = [];
  bool _searching = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    if (q.isEmpty) {
      setState(() => _results = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final r = await ApiService().searchCustomers(q);
      setState(() => _results = r);
    } finally {
      setState(() => _searching = false);
    }
  }

  Future<void> _addCustomer() async {
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => const _AddCustomerDialog(),
    );
    if (result == null) return;
    try {
      final created = await ApiService().createCustomer(result);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Customer added'), backgroundColor: Colors.green),
        );
        // Re-run the last search to show the new customer
        if (_searchCtrl.text.isNotEmpty) {
          await _search(_searchCtrl.text);
        } else {
          setState(() => _results = [created]);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _openProfile(Customer c) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
          builder: (_) => CustomerProfileScreen(customer: c)),
    );
    // Re-fetch to pick up any edits
    if (_searchCtrl.text.isNotEmpty) {
      await _search(_searchCtrl.text);
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
        title: const Text('Customers'),
        actions: [
          IconButton(
              icon: const Icon(Icons.person_add), onPressed: _addCustomer),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search by name or phone...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searching
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : null,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              onChanged: _search,
            ),
          ),
          Expanded(
            child: _results.isEmpty
                ? const Center(
                    child: Text('Search for customers',
                        style: TextStyle(color: Colors.grey)))
                : ListView.builder(
                    itemCount: _results.length,
                    itemBuilder: (ctx, i) {
                      final c = _results[i];
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: _segmentColor(c.segment),
                          child: Text(
                            c.name[0].toUpperCase(),
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                        title: Text(c.name),
                        subtitle: Text(c.phone ?? c.email ?? ''),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            _SegmentBadge(segment: c.segment),
                            if (c.outstandingDue > 0)
                              Text(
                                'Due: ₹${c.outstandingDue.toStringAsFixed(0)}',
                                style: const TextStyle(
                                    color: Colors.red, fontSize: 11),
                              ),
                          ],
                        ),
                        onTap: () => _openProfile(c),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Color _segmentColor(String segment) {
    switch (segment) {
      case 'VIP':
        return Colors.purple;
      case 'PREMIUM':
        return Colors.orange;
      case 'GOLD':
        return const Color(0xFFFFD700);
      default:
        return Colors.grey;
    }
  }
}

class _SegmentBadge extends StatelessWidget {
  final String segment;
  const _SegmentBadge({required this.segment});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFF6C63FF).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        segment,
        style: const TextStyle(fontSize: 10, color: Color(0xFF6C63FF)),
      ),
    );
  }
}

class _AddCustomerDialog extends StatefulWidget {
  const _AddCustomerDialog();

  @override
  State<_AddCustomerDialog> createState() => _AddCustomerDialogState();
}

class _AddCustomerDialogState extends State<_AddCustomerDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add Customer'),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Name *'),
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            TextFormField(
              controller: _phoneCtrl,
              decoration: const InputDecoration(labelText: 'Phone'),
              keyboardType: TextInputType.phone,
            ),
            TextFormField(
              controller: _emailCtrl,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: () {
            if (_formKey.currentState!.validate()) {
              Navigator.pop(context, {
                'name': _nameCtrl.text.trim(),
                'phone': _phoneCtrl.text.trim(),
                'email': _emailCtrl.text.trim(),
              });
            }
          },
          child: const Text('Add'),
        ),
      ],
    );
  }
}
