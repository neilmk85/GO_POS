import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pos_mobile/main.dart';

class OperationsHubScreen extends StatelessWidget {
  const OperationsHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final modules = [
      _Module('Expenses', 'Track business expenses', Icons.payments_outlined,
          const Color(0xFFF44336), '/expenses'),
      _Module('Shifts', 'Open & close cash shifts', Icons.schedule_outlined,
          const Color(0xFF00BCD4), '/shifts'),
      _Module('Production', 'Manufacturing orders & entries', Icons.precision_manufacturing_outlined,
          const Color(0xFF9C27B0), '/production'),
      _Module('Business Ops', 'Daily operational logs', Icons.factory_outlined,
          const Color(0xFF607D8B), '/business'),
      _Module('Inventory', 'Stock levels & adjustments', Icons.warehouse_outlined,
          const Color(0xFF4CAF50), '/inventory'),
      _Module('Products', 'Product catalogue', Icons.inventory_2_outlined,
          const Color(0xFFFF9800), '/products'),
    ];

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_outlined),
          onPressed: openAppDrawer,
          tooltip: 'Open menu',
        ),
        title: const Text('Operations'),
        backgroundColor: const Color(0xFF9C27B0),
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
