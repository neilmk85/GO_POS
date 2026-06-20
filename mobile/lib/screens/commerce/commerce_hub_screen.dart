import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pos_mobile/main.dart';

class CommerceHubScreen extends StatelessWidget {
  const CommerceHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final modules = [
      _Module('Sales Orders', 'B2B sales & confirmations', Icons.shopping_bag_outlined,
          const Color(0xFF4CAF50), '/sales-orders'),
      _Module('Purchases', 'Purchase orders & receiving', Icons.local_shipping_outlined,
          const Color(0xFFFF9800), '/purchases'),
      _Module('Invoices', 'Billing & payment status', Icons.description_outlined,
          const Color(0xFF2196F3), '/invoices'),
      _Module('Vendors', 'Supplier directory', Icons.store_outlined,
          const Color(0xFF9C27B0), '/vendors'),
      _Module('Orders', 'POS / retail orders', Icons.receipt_long_outlined,
          const Color(0xFF00BCD4), '/orders'),
      _Module('Customers', 'Customer profiles', Icons.people_outline,
          const Color(0xFFE91E63), '/customers'),
    ];

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_outlined),
          onPressed: openAppDrawer,
          tooltip: 'Open menu',
        ),
        title: const Text('Commerce'),
        backgroundColor: const Color(0xFF4CAF50),
        foregroundColor: Colors.white,
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: modules.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 14,
          crossAxisSpacing: 14,
          childAspectRatio: 1.15,
        ),
        itemBuilder: (ctx, i) => _ModuleCard(module: modules[i]),
      ),
    );
  }
}

class _Module {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String path;
  const _Module(this.title, this.subtitle, this.icon, this.color, this.path);
}

class _ModuleCard extends StatelessWidget {
  final _Module module;
  const _ModuleCard({required this.module});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: module.color.withOpacity(0.08),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: module.color.withOpacity(0.2)),
      ),
      child: InkWell(
        onTap: () => context.push(module.path),
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: module.color.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(module.icon, color: module.color, size: 24),
              ),
              const Spacer(),
              Text(module.title,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
              const SizedBox(height: 2),
              Text(module.subtitle,
                  style: TextStyle(
                      fontSize: 11,
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.55)),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ),
    );
  }
}
