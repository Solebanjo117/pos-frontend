<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('redirects guests from financial transfer pages', function (string $routeName, array $parameters = []): void {
    $this->get(route($routeName, $parameters))->assertRedirect(route('login'));
})->with([
    ['finance.transfers.index'],
    ['finance.transfers.create'],
    ['finance.transfers.show', ['id' => 1]],
    ['finance.accounts.index'],
]);

it('renders transfer pages for administrators and managers', function (string $role): void {
    $user = User::factory()->create([
        'role' => $role,
        'is_active' => true,
    ]);

    $this->actingAs($user)
        ->get(route('finance.transfers.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Finance/Transfers/Index'));

    $this->actingAs($user)
        ->get(route('finance.transfers.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Finance/Transfers/Create'));

    $this->actingAs($user)
        ->get(route('finance.transfers.show', ['id' => 9]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Finance/Transfers/Show')
            ->where('transferId', 9));
})->with(['admin', 'manager']);

it('limits the financial account catalog to administrators', function (): void {
    $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
    $manager = User::factory()->create(['role' => 'manager', 'is_active' => true]);
    $cashier = User::factory()->create(['role' => 'cashier', 'is_active' => true]);

    $this->actingAs($admin)
        ->get(route('finance.accounts.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Finance/Accounts/Index'));

    $this->actingAs($manager)
        ->get(route('finance.accounts.index'))
        ->assertForbidden();

    $this->actingAs($cashier)
        ->get(route('finance.transfers.index'))
        ->assertForbidden();
});
