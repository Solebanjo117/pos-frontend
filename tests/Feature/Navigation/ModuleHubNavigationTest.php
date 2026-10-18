<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('redirects guests from every module hub', function (string $routeName) {
    $this->get(route($routeName))->assertRedirect(route('login'));
})->with([
    'home' => 'dashboard',
    'cash' => 'cash.index',
    'queues' => 'queues.index',
    'sales' => 'sales.index',
    'purchases' => 'purchases.index',
    'inventory' => 'inventory.overview',
    'vehicles' => 'vehicles.index',
    'customers' => 'customers.overview',
    'finance' => 'finance.index',
    'records' => 'records.index',
    'reports' => 'reports.index',
    'settings' => 'settings.overview',
]);

it('renders every module hub for an administrator', function (string $routeName, string $component) {
    $admin = User::factory()->create([
        'role' => 'admin',
        'is_active' => true,
    ]);

    $this->actingAs($admin)
        ->get(route($routeName))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component));
})->with([
    ['dashboard', 'Dashboard'],
    ['cash.index', 'Cash/Index'],
    ['queues.index', 'Queues/Index'],
    ['sales.index', 'Sales/Index'],
    ['purchases.index', 'Purchases/Index'],
    ['inventory.overview', 'Inventory/Overview'],
    ['vehicles.index', 'Vehicles/Index'],
    ['customers.overview', 'Customers/Overview'],
    ['finance.index', 'Finance/Index'],
    ['records.index', 'Records/Index'],
    ['reports.index', 'Reports/Index'],
    ['settings.overview', 'settings/Overview'],
]);

it('applies the approved role matrix to restricted hubs', function (string $role, array $allowed, array $forbidden) {
    $user = User::factory()->create([
        'role' => $role,
        'is_active' => true,
    ]);

    foreach ($allowed as $routeName) {
        $this->actingAs($user)->get(route($routeName))->assertOk();
    }

    foreach ($forbidden as $routeName) {
        $this->actingAs($user)->get(route($routeName))->assertForbidden();
    }
})->with([
    'cashier' => [
        'cashier',
        ['cash.index', 'queues.index', 'inventory.overview', 'vehicles.index', 'customers.overview', 'finance.index', 'settings.overview'],
        ['sales.index', 'purchases.index', 'records.index', 'reports.index'],
    ],
    'buyer' => [
        'buyer',
        ['queues.index', 'sales.index', 'purchases.index', 'inventory.overview', 'vehicles.index', 'customers.overview', 'finance.index', 'settings.overview'],
        ['cash.index', 'records.index', 'reports.index'],
    ],
    'seller' => [
        'seller',
        ['queues.index', 'sales.index', 'inventory.overview', 'vehicles.index', 'customers.overview', 'finance.index', 'settings.overview'],
        ['cash.index', 'purchases.index', 'records.index', 'reports.index'],
    ],
]);

it('keeps representative operational routes unchanged', function () {
    $admin = User::factory()->create([
        'role' => 'admin',
        'is_active' => true,
    ]);

    $this->actingAs($admin)->get(route('products.index'))->assertOk();
    $this->actingAs($admin)->get(route('customers.index'))->assertOk();
    $this->actingAs($admin)->get(route('purchase-orders.index'))->assertOk();
    $this->actingAs($admin)->get(route('reports.financial'))->assertOk();
});

it('opens the existing POS quote editor only for quote creators', function (string $role) {
    $user = User::factory()->create(['role' => $role, 'is_active' => true]);

    $this->actingAs($user)->get(route('quotes.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('SalesQuotes/Editor')->missing('quoteId'));
})->with(['admin', 'manager', 'seller']);

it('does not broaden access to quote creation', function (string $role) {
    $user = User::factory()->create(['role' => $role, 'is_active' => true]);

    $this->actingAs($user)->get(route('quotes.create'))->assertForbidden();
})->with(['buyer', 'assistant', 'cashier']);

it('redirects guests away from quote creation', function () {
    $this->get(route('quotes.create'))->assertRedirect(route('login'));
});

it('keeps both histories and the editor return route in Transactions', function () {
    $seller = User::factory()->create(['role' => 'seller', 'is_active' => true]);

    $this->actingAs($seller)->get(route('sales-orders.index'))->assertRedirect('/transactions?type=order');
    $this->get(route('sales-quotes.index'))->assertRedirect('/transactions?type=quote');
});
