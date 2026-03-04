<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    /**
     * Display a listing of products.
     */
    public function index(): Response
    {
        return Inertia::render('Products/Index');
    }

    /**
     * Show the form for creating a new product.
     */
    public function create(): Response
    {
        return Inertia::render('Products/Create');
    }

    /**
     * Display the specified product.
     */
    public function show(int $id): Response
    {
        return Inertia::render('Products/Show', [
            'productId' => $id,
        ]);
    }

    /**
     * Show the form for editing the specified product.
     */
    public function edit(int $id): Response
    {
        return Inertia::render('Products/Edit', [
            'productId' => $id,
        ]);
    }
}
