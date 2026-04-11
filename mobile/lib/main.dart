import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'providers/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/pos/pos_screen.dart';
import 'screens/products/products_screen.dart';
import 'screens/inventory/inventory_screen.dart';
import 'screens/customers/customers_screen.dart';
import 'screens/orders/orders_screen.dart';
import 'screens/reports/reports_screen.dart';

void main() {
  runApp(const ProviderScope(child: PosApp()));
}

class PosApp extends ConsumerWidget {
  const PosApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    final router = GoRouter(
      initialLocation: auth.isAuthenticated ? '/pos' : '/login',
      redirect: (ctx, state) {
        final loggedIn = ref.read(authProvider).isAuthenticated;
        final onLogin = state.matchedLocation == '/login';
        if (!loggedIn && !onLogin) return '/login';
        if (loggedIn && onLogin) return '/pos';
        return null;
      },
      routes: [
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        ShellRoute(
          builder: (ctx, state, child) => _AppShell(child: child),
          routes: [
            GoRoute(path: '/pos', builder: (_, __) => const POSScreen()),
            GoRoute(path: '/products', builder: (_, __) => const ProductsScreen()),
            GoRoute(path: '/inventory', builder: (_, __) => const InventoryScreen()),
            GoRoute(path: '/customers', builder: (_, __) => const CustomersScreen()),
            GoRoute(path: '/orders', builder: (_, __) => const OrdersScreen()),
            GoRoute(path: '/reports', builder: (_, __) => const ReportsScreen()),
          ],
        ),
      ],
    );

    return MaterialApp.router(
      title: 'POS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6C63FF),
          brightness: Brightness.light,
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6C63FF),
          brightness: Brightness.dark,
        ),
      ),
      routerConfig: router,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en')],
    );
  }
}

class _AppShell extends ConsumerWidget {
  final Widget child;
  const _AppShell({required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).matchedLocation;
    final navItems = [
      (icon: Icons.point_of_sale, label: 'POS', path: '/pos'),
      (icon: Icons.inventory_2_outlined, label: 'Products', path: '/products'),
      (icon: Icons.warehouse_outlined, label: 'Inventory', path: '/inventory'),
      (icon: Icons.people_outline, label: 'Customers', path: '/customers'),
      (icon: Icons.receipt_long_outlined, label: 'Orders', path: '/orders'),
      (icon: Icons.bar_chart_outlined, label: 'Reports', path: '/reports'),
    ];
    final currentIndex =
        navItems.indexWhere((n) => location.startsWith(n.path));

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex < 0 ? 0 : currentIndex,
        onDestinationSelected: (i) => context.go(navItems[i].path),
        destinations: navItems
            .map((n) => NavigationDestination(
                  icon: Icon(n.icon),
                  label: n.label,
                ))
            .toList(),
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
      ),
    );
  }
}
