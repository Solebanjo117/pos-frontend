<?php

use App\Http\Controllers\FrontendApiProxyController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    if (Auth::check()) {
        return redirect(Auth::user()?->role === 'cashier' ? '/pos/cashier' : '/pos');
    }

    return Inertia::render('Welcome', [
        'canRegister' => false,
    ]);
})->name('home');

// POS (Point of Sale) - Main page
Route::middleware(['auth', 'role:admin,manager,cashier'])->get('/pos', function () {
    return Inertia::render('POS/Index');
})->name('pos');

Route::middleware(['auth', 'role:admin,manager,cashier'])->get('/pos/cashier', function () {
    return Inertia::render('POS/CashierQueue');
})->name('pos.cashier');

Route::middleware(['auth', 'role:admin,manager,cashier'])->get('/queues/delivery', function () {
    return Inertia::render('Queues/DeliveryQueue');
})->name('queues.delivery');

Route::middleware(['auth'])->get('/queues/purchase-orders', function () {
    return Inertia::render('Queues/PurchaseOrderQueue');
})->name('queues.purchase-orders');

Route::get('dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware(['auth', 'role:admin,manager,cashier'])->get('/cash', function () {
    return Inertia::render('Cash/Index');
})->name('cash.index');

Route::middleware(['auth'])->get('/queues', function () {
    return Inertia::render('Queues/Index');
})->name('queues.index');

Route::middleware(['auth', 'role:admin,manager,buyer,seller,assistant'])->get('/sales', function () {
    return Inertia::render('Sales/Index');
})->name('sales.index');

Route::middleware(['auth', 'role:admin,manager,buyer'])->get('/purchases', function () {
    return Inertia::render('Purchases/Index');
})->name('purchases.index');

Route::middleware(['auth'])->get('/finance', function () {
    return Inertia::render('Finance/Index');
})->name('finance.index');

Route::middleware(['auth'])->get('/changelog', function () {
    return Inertia::render('Changelog/Index');
})->name('changelog.index');

// Product Routes
Route::middleware(['auth'])->prefix('products')->name('products.')->group(function () {
    Route::get('/', [App\Http\Controllers\ProductController::class, 'index'])->name('index');
    Route::get('/create', [App\Http\Controllers\ProductController::class, 'create'])
        ->name('create')
        ->middleware('role:admin,manager,buyer');
    Route::get('/import', function () {
        return Inertia::render('Products/Import');
    })->name('import')->middleware('role:admin,manager');
    Route::get('/{product}', [App\Http\Controllers\ProductController::class, 'show'])->name('show');
    Route::get('/{product}/edit', [App\Http\Controllers\ProductController::class, 'edit'])
        ->name('edit')
        ->middleware('role:admin,manager,buyer');
});

// Inventory Routes
Route::middleware(['auth'])->get('/inventory/overview', function () {
    return Inertia::render('Inventory/Overview');
})->name('inventory.overview');

Route::middleware(['auth', 'role:admin,manager,buyer,assistant'])->prefix('inventory')->name('inventory.')->group(function () {
    Route::get('/', function () {
        return Inertia::render('Inventory/Inventory');
    })->name('index');

    Route::get('/products/{productId}', function ($productId) {
        return Inertia::render('Inventory/ProductMovements', [
            'productId' => (int) $productId,
        ]);
    })->name('products.show');

    Route::get('/waste', function () {
        return Inertia::render('Inventory/Waste');
    })->name('waste');
});

// Warehouse Routes
Route::middleware(['auth'])->prefix('warehouses')->name('warehouses.')->group(function () {
    Route::get('/queue', function () {
        return Inertia::render('Warehouse/Queue');
    })->name('queue')->middleware('role:admin,manager,buyer,assistant');

    Route::get('/', function () {
        return Inertia::render('Warehouses/Index');
    })->name('index');
    Route::get('/create', function () {
        return Inertia::render('Warehouses/Create');
    })->name('create');
    Route::get('/{id}', function ($id) {
        return Inertia::render('Warehouses/Show', ['warehouseId' => (int) $id]);
    })->name('show');
    Route::get('/{id}/edit', function ($id) {
        return Inertia::render('Warehouses/Edit', ['warehouseId' => (int) $id]);
    })->name('edit');
});

// Inventory Movements routes
Route::middleware(['auth'])->group(function () {
    Route::get('/inventory-movements', function () {
        return Inertia::render('InventoryMovements/Index');
    });
    Route::get('/inventory-movements/inbound/create', function () {
        return Inertia::render('InventoryMovements/CreateInbound');
    })->middleware('role:admin,manager,buyer,assistant');
    Route::get('/inventory-movements/outbound/create', function () {
        return Inertia::render('InventoryMovements/CreateOutbound');
    })->middleware('role:admin,manager');
    Route::get('/inventory-movements/transfer/create', function () {
        return Inertia::render('InventoryMovements/CreateTransfer');
    })->middleware('role:admin,manager');
    Route::get('/inventory-movements/{id}', function ($id) {
        return Inertia::render('InventoryMovements/Show', ['id' => $id]);
    });
});

// Inventory Transfers routes
Route::middleware(['auth'])->prefix('inventory-transfers')->name('inventory-transfers.')->group(function () {
    Route::get('/', function () {
        return Inertia::render('InventoryTransfers/Index');
    })->name('index');
    Route::get('/create', function () {
        return Inertia::render('InventoryTransfers/Create');
    })->name('create')->middleware('role:admin,manager');
    Route::get('/{id}', function ($id) {
        return Inertia::render('InventoryTransfers/Show', ['transferId' => (int) $id]);
    })->name('show');
});

// Reports routes
Route::middleware(['auth', 'role:admin,manager'])->prefix('reports')->name('reports.')->group(function () {
    Route::get('/', function () {
        return Inertia::render('Reports/Index');
    })->name('index');
    Route::get('/stock-levels', function () {
        return Inertia::render('Reports/StockLevels');
    })->name('stock-levels');

    Route::get('/movement-history', function () {
        return Inertia::render('Reports/MovementHistory');
    })->name('movement-history');

    Route::get('/financial', function () {
        return Inertia::render('Reports/Financial');
    })->name('financial');

    Route::get('/customer-references', function () {
        return Inertia::render('Reports/CustomerReferences');
    })->name('customer-references');

    Route::get('/sales-by-client', function () {
        return Inertia::render('Reports/SalesByClient');
    })->name('sales-by-client');

    Route::get('/sales-by-product', fn () => Inertia::render('Reports/OperationalAnalytics', ['reportKey' => 'sales-by-product']))->name('sales-by-product');
    Route::get('/purchases-by-supplier', fn () => Inertia::render('Reports/OperationalAnalytics', ['reportKey' => 'purchases-by-supplier']))->name('purchases-by-supplier');
    Route::get('/credit-notes', fn () => Inertia::render('Reports/OperationalAnalytics', ['reportKey' => 'credit-notes']))->name('credit-notes');
    Route::get('/valued-inventory', fn () => Inertia::render('Reports/OperationalAnalytics', ['reportKey' => 'valued-inventory']))->name('valued-inventory');

});

Route::middleware(['auth', 'role:admin,manager'])->get('/records', function () {
    return Inertia::render('Records/Index');
})->name('records.index');

Route::middleware(['auth', 'role:admin,manager,cashier'])->get('/reports/z-report', function () {
    return Inertia::render('Reports/ZReport');
})->name('reports.z-report');

// POS Sessions (Cierres de Caja)
Route::middleware(['auth', 'role:admin,manager,cashier'])->get('/pos-sessions', function () {
    return Inertia::render('POS/Sessions/Index');
})->name('pos-sessions.index');

// Customers routes
Route::middleware(['auth'])->group(function () {
    Route::get('/customers', function () {
        return Inertia::render('Customers/Index');
    })->name('customers.index');

    Route::get('/customers/overview', function () {
        return Inertia::render('Customers/Overview');
    })->name('customers.overview');

    Route::get('/customers/create', function () {
        return Inertia::render('Customers/Create');
    })->name('customers.create');

    Route::get('/customers/{id}', function ($id) {
        return Inertia::render('Customers/Show', ['customerId' => (int) $id]);
    })->name('customers.show');

    Route::get('/customers/{id}/edit', function ($id) {
        return Inertia::render('Customers/Edit', ['customerId' => $id]);
    })->name('customers.edit');
});

// Accounts Receivable (Cuentas por Cobrar)
Route::middleware(['auth'])->group(function () {
    Route::get('/ar', function () {
        return Inertia::render('AR/Index');
    })->name('ar.index');

    Route::get('/accounts-receivable', function () {
        return Inertia::render('AR/Index');
    })->name('accounts-receivable.index');
});

// Sales Orders routes
Route::middleware(['auth'])->prefix('sales-orders')->name('sales-orders.')->group(function () {
    Route::get('/', function () {
        return Inertia::render('SalesOrders/Index');
    })->name('index')->middleware('role:admin,manager,buyer,seller,assistant');

    Route::get('/create', function () {
        return Inertia::render('SalesOrders/Create');
    })->name('create')->middleware('role:admin,manager,buyer,seller,assistant');

    Route::get('/{id}', function ($id) {
        return Inertia::render('SalesOrders/Show', ['id' => (int) $id]);
    })->name('show');

    Route::get('/{id}/edit', function ($id) {
        return Inertia::render('SalesOrders/Edit', ['id' => (int) $id]);
    })->name('edit')->middleware('role:admin,manager,buyer,seller,assistant');
});

// Returns index (must be before /returns/{orderId})
Route::middleware(['auth'])->get('/returns', function () {
    return Inertia::render('Returns/Index');
})->name('returns.index');

Route::middleware(['auth'])->get('/returns/{id}', function ($id) {
    return Inertia::render('Returns/Show', ['id' => (int) $id]);
})->whereNumber('id')->name('returns.show');

// Returns (POS in return mode)
Route::middleware(['auth', 'role:admin,manager,cashier'])->get('/returns/orders/{orderId}', fn ($orderId) => Inertia::render('SalesOrders/ReturnEditor', [
    'orderId' => (int) $orderId,
])
)->name('returns.create');

// Vehicle Management Routes
Route::middleware(['auth'])->prefix('vehicles')->name('vehicles.')->group(function () {
    Route::get('/overview', function () {
        return Inertia::render('Vehicles/Overview');
    })->name('overview');

    Route::get('/', function () {
        return Inertia::render('Vehicles/Index');
    })->name('index');

    // Engines (R21)
    Route::get('/engines', function () {
        return Inertia::render('Vehicles/Engines/Index');
    })->name('engines.index');
    Route::get('/engines/create', function () {
        return Inertia::render('Vehicles/Engines/Create');
    })->name('engines.create')->middleware('role:admin,manager');
    Route::get('/engines/{id}/edit', function ($id) {
        return Inertia::render('Vehicles/Engines/Edit', ['engineId' => (int) $id]);
    })->name('engines.edit')->middleware('role:admin,manager');

    // Chassis
    Route::get('/chassis', function () {
        return redirect('/vehicles');
    })->name('chassis.index');
    Route::get('/chassis/create', function () {
        return redirect('/vehicles');
    })->name('chassis.create');
    Route::get('/chassis/{id}/edit', function () {
        return redirect('/vehicles');
    })->name('chassis.edit');

    Route::get('/import', function () {
        return Inertia::render('Vehicles/Import');
    })->name('import')->middleware('role:admin,manager');
});

// Work Orders
Route::middleware(['auth'])->prefix('work-orders')->name('work-orders.')->group(function () {
    Route::get('/', function () {
        return Inertia::render('WorkOrders/Index');
    })->name('index');
    Route::get('/create', function () {
        return Inertia::render('WorkOrders/Form');
    })->name('create');
    Route::get('/{id}', function ($id) {
        return Inertia::render('WorkOrders/Show', ['workOrderId' => (int) $id]);
    })->name('show');
    Route::get('/{id}/edit', function ($id) {
        return Inertia::render('WorkOrders/Form', ['workOrderId' => (int) $id]);
    })->name('edit');
});

require __DIR__.'/settings.php';

Route::middleware(['auth', 'role:admin,manager,buyer'])->group(function () {
    // ==================== SUPPLIERS ====================
    Route::get('/suppliers', function () {
        return Inertia::render('Suppliers/Index');
    })->name('suppliers.index');

    Route::get('/suppliers/create', function () {
        return Inertia::render('Suppliers/Create');
    })->name('suppliers.create');

    Route::get('/suppliers/import', function () {
        return Inertia::render('Suppliers/Import');
    })->name('suppliers.import')->middleware('role:admin,manager');

    Route::get('/suppliers/{id}', function ($id) {
        return Inertia::render('Suppliers/Show', ['supplierId' => (int) $id]);
    })->name('suppliers.show');

    Route::get('/suppliers/{id}/edit', function ($id) {
        return Inertia::render('Suppliers/Edit', ['supplierId' => (int) $id]);
    })->name('suppliers.edit');

    // ==================== SUPPLY LIST (R29) ====================
    Route::get('/supply-list', function () {
        return Inertia::render('SupplyList/Index');
    })->name('supply-list.index');

    // ==================== PURCHASE ORDERS ====================
    Route::get('/purchase-orders', function () {
        return Inertia::render('PurchaseOrders/Index');
    })->name('purchase-orders.index');

    Route::get('/purchase-orders/create', function () {
        return Inertia::render('PurchaseOrders/Create');
    })->name('purchase-orders.create');

    // IMPORTANT: Specific routes MUST come before dynamic {id} routes
    Route::get('/purchase-orders/smart-reorder', function () {
        return Inertia::render('PurchaseOrders/SmartReorder');
    })->name('purchase-orders.smart-reorder');

    Route::get('/purchase-orders/{id}', function ($id) {
        return Inertia::render('PurchaseOrders/Show', ['purchaseOrderId' => (int) $id]);
    })->name('purchase-orders.show');

    Route::get('/purchase-orders/{id}/edit', function ($id) {
        return Inertia::render('PurchaseOrders/Create', ['purchaseOrderId' => (int) $id]);
    })->name('purchase-orders.edit');

    Route::get('/purchase-orders/{id}/receive', function ($id) {
        return Inertia::render('PurchaseOrders/Receive', ['purchaseOrderId' => (int) $id]);
    })->name('purchase-orders.receive');

    // ==================== ACCOUNTS PAYABLE ====================
    Route::get('/accounts-payable', function () {
        return Inertia::render('AccountsPayable/Index');
    })->name('accounts-payable.index');

    Route::get('/operational-expenses', function () {
        return Inertia::render('OperationalExpenses/Index');
    })->name('operational-expenses.index')->middleware('role:admin,manager');

    Route::get('/operational-expense-beneficiaries/{id}', function ($id) {
        return Inertia::render('OperationalExpenses/BeneficiaryShow', ['beneficiaryId' => (int) $id]);
    })->name('operational-expense-beneficiaries.show')->middleware('role:admin,manager');
});

Route::get('/api/v1/store-settings', FrontendApiProxyController::class)
    ->defaults('path', 'store-settings');
Route::get('/api/v1/pricing-formula/presets', FrontendApiProxyController::class)
    ->defaults('path', 'pricing-formula/presets');
Route::post('/api/v1/pricing-formula/preview', FrontendApiProxyController::class)
    ->defaults('path', 'pricing-formula/preview');

Route::middleware(['auth'])
    ->any('/api/v1/{path}', FrontendApiProxyController::class)
    ->where('path', '.*');

// ==================== BRANDS ====================
Route::middleware(['auth', 'role:admin,manager'])->prefix('brands')->name('brands.')->group(function () {
    Route::get('/', function () {
        return Inertia::render('Brands/Index');
    })->name('index');

    Route::get('/create', function () {
        return Inertia::render('Brands/Create');
    })->name('create');

    Route::get('/import', function () {
        return Inertia::render('Brands/Import');
    })->name('import');

    Route::get('/{id}/edit', function ($id) {
        return Inertia::render('Brands/Edit', ['id' => (string) $id]);
    })->name('edit');
});

// ==================== CATEGORIES ====================
Route::middleware(['auth', 'role:admin,manager'])->prefix('categories')->name('categories.')->group(function () {
    Route::get('/', function () {
        return Inertia::render('Categories/Index');
    })->name('index');

    Route::get('/create', function () {
        return Inertia::render('Categories/Create');
    })->name('create');

    Route::get('/import', function () {
        return Inertia::render('Categories/Import');
    })->name('import');

    Route::get('/{id}/edit', function ($id) {
        return Inertia::render('Categories/Edit', ['id' => (string) $id]);
    })->name('edit');
});

// ==================== USERS (Admin only) ====================
Route::middleware(['auth', 'role:admin'])->prefix('users')->name('users.')->group(function () {
    Route::get('/', function () {
        $users = \App\Models\User::select('id', 'name', 'username', 'email', 'role', 'is_active')
            ->with('warehouses:id,name')
            ->get();

        return Inertia::render('Users/Index', ['users' => $users]);
    })->name('index');

    Route::get('/create', function () {
        $warehouses = \App\Models\Warehouse::where('status', 'active')->select('id', 'name')->orderBy('name')->get();

        return Inertia::render('Users/Form', ['warehouses' => $warehouses]);
    })->name('create');

    Route::get('/{id}/edit', function ($id) {
        $user = \App\Models\User::with('warehouses:id')->findOrFail($id);
        $warehouses = \App\Models\Warehouse::where('status', 'active')->select('id', 'name')->orderBy('name')->get();

        return Inertia::render('Users/Form', [
            'userId' => (int) $id,
            'userData' => array_merge(
                $user->only('id', 'name', 'username', 'email', 'role', 'is_active'),
                ['warehouse_ids' => $user->warehouses->pluck('id')->toArray()]
            ),
            'warehouses' => $warehouses,
        ]);
    })->name('edit');

    // CRUD API endpoints
    Route::post('/', function (\Illuminate\Http\Request $request) {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'username' => 'required|string|max:50|unique:users,username',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'role' => 'required|in:admin,manager,buyer,seller,cashier,assistant',
            'warehouse_ids' => 'nullable|array',
            'warehouse_ids.*' => 'exists:warehouses,id',
        ]);
        unset($validated['warehouse_ids']);
        $validated['password'] = \Illuminate\Support\Facades\Hash::make($validated['password']);
        $user = \App\Models\User::create($validated);

        if ($request->has('warehouse_ids')) {
            $user->warehouses()->sync($request->input('warehouse_ids', []));
            // Set first warehouse as current
            $firstWh = $request->input('warehouse_ids')[0] ?? null;
            if ($firstWh) {
                $user->update(['current_warehouse_id' => $firstWh]);
            }
        }

        return response()->json(['message' => 'Usuario creado', 'data' => $user->load('warehouses:id,name')], 201);
    })->name('store');

    Route::put('/{id}', function (\Illuminate\Http\Request $request, $id) {
        $user = \App\Models\User::findOrFail($id);
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'username' => 'sometimes|string|max:50|unique:users,username,'.$id,
            'email' => 'sometimes|email|unique:users,email,'.$id,
            'password' => 'nullable|string|min:8|confirmed',
            'role' => 'sometimes|in:admin,manager,buyer,seller,cashier,assistant',
            'is_active' => 'sometimes|boolean',
            'warehouse_ids' => 'nullable|array',
            'warehouse_ids.*' => 'exists:warehouses,id',
        ]);
        unset($validated['warehouse_ids']);
        if (! empty($validated['password'])) {
            $validated['password'] = \Illuminate\Support\Facades\Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }
        $user->update($validated);

        if ($request->has('warehouse_ids')) {
            $user->warehouses()->sync($request->input('warehouse_ids', []));
        }

        return response()->json(['message' => 'Usuario actualizado', 'data' => $user->load('warehouses:id,name')]);
    })->name('update');

    Route::delete('/{id}', function ($id) {
        $user = \App\Models\User::findOrFail($id);
        if ($user->role === 'admin' && \App\Models\User::where('role', 'admin')->where('is_active', true)->count() <= 1) {
            return response()->json(['message' => 'No puedes desactivar al único administrador.'], 422);
        }
        $user->update(['is_active' => false]);

        return response()->json(['message' => 'Usuario desactivado']);
    })->name('destroy');
});

// ==================== SETTINGS / BACKUPS (Admin only) ====================
Route::middleware(['auth', 'role:admin'])->prefix('settings')->name('settings.')->group(function () {
    Route::get('/backups', function () {
        return Inertia::render('settings/Backups');
    })->name('backups');
    Route::get('/activity-logs', function () {
        return Inertia::render('settings/ActivityLogs');
    })->name('activity-logs');
    Route::get('/store', function () {
        return Inertia::render('settings/Store');
    })->name('store');
});

// ==================== SALES QUOTES (Cotizaciones) ====================
Route::middleware(['auth'])->group(function () {
    Route::get('/sales-quotes', function () {
        return Inertia::render('SalesQuotes/Index');
    })->name('sales-quotes.index')->middleware('role:admin,manager,buyer,seller,assistant');
    Route::get('/sales-quotes/create', function () {
        return Inertia::render('SalesQuotes/Editor');
    })->name('sales-quotes.create')->middleware('role:admin,manager,buyer,seller,assistant');
    Route::get('/sales-quotes/{id}', function ($id) {
        return Inertia::render('SalesQuotes/Show', ['id' => (int) $id]);
    })->name('sales-quotes.show');
    Route::get('/sales-quotes/{id}/edit', function ($id) {
        return Inertia::render('SalesQuotes/Editor', ['quoteId' => (int) $id]);
    })->name('sales-quotes.edit')->middleware('role:admin,manager,buyer,seller,assistant');

    // Quote Editor (POS in quote-only mode)
    Route::get('/quotes/create', fn () => Inertia::render('SalesQuotes/Editor')
    )->name('quotes.create')->middleware('role:admin,manager,seller');

    Route::get('/quotes/{id}/edit', fn ($id) => Inertia::render('SalesQuotes/Editor', [
        'quoteId' => (int) $id,
    ])
    )->name('quotes.edit')->middleware('role:admin,manager,seller');
});
