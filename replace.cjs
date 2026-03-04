const fs = require('fs');
const file = 'c:/Users/JUANANTONIOCASTILLAO/Herd/pos-frontend/resources/js/pages/Dashboard.vue';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '                <!-- Content Grid -->';
const endMarker = '                    <!-- Rentabilidad por Marca -->';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = `                <!-- Secondary Charts Grid -->
                <div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <!-- Categorías Doughnut -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Ventas por Categoría</h2>
                        <div class="h-64">
                            <CategorySalesChart :data="salesByCategory || []" />
                        </div>
                    </div>
                    
                    <!-- Mejores Cajeros -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Desempeño del Personal</h2>
                        <TopCashiers :cashiers="topCashiers || []" />
                    </div>
                </div>

                <!-- Content Grid -->
                <div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <!-- Productos Más Vendidos -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Productos Más Vendidos</h2>
                        <div class="space-y-3">
                            <div v-for="(product, index) in topProducts" :key="index" class="flex items-center justify-between">
                                <span class="text-sm text-gray-900 dark:text-white">{{ product.name }}</span>
                                <span class="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                                    {{ product.sales }} vendidos
                                </span>
                            </div>
                            <div v-if="topProducts.length === 0" class="text-sm text-center text-gray-500 py-4">
                                No hay datos de ventas.
                            </div>
                        </div>
                    </div>
                    
                    <!-- Actividad Reciente -->
                    <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                        <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Actividad Reciente</h2>
                        <RecentActivityFeed :activities="recentActivity || []" />
                    </div>

                    <div class="flex flex-col gap-6">
                        <!-- Stock Bajo -->
                        <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                            <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Stock Bajo</h2>
                            <div class="space-y-3">
                                <div v-for="(product, index) in lowStockProducts" :key="index" class="flex items-center justify-between">
                                    <span class="text-sm text-gray-900 dark:text-white">{{ product.name }}</span>
                                    <span class="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">
                                        {{ product.stock }} uds
                                    </span>
                                </div>
                                <div v-if="lowStockProducts.length === 0" class="text-sm text-center text-gray-500 py-4">
                                    Inventario saludable.
                                </div>
                            </div>
                            <button @click="navigateTo('/inventory')" class="mt-4 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                                Ver Inventario
                            </button>
                        </div>
    
                        <!-- Accesos Rápidos -->
                        <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                            <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Accesos Rápidos</h2>
                            <div class="grid grid-cols-2 gap-3">
                                <button @click="navigateTo('/products/create')" class="flex flex-col items-center rounded-lg border-2 border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-gray-700">
                                    <svg class="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                    </svg>
                                    <span class="mt-2 text-xs font-medium text-gray-900 dark:text-white">Nuevo</span>
                                </button>
    
                                <button @click="navigateTo('/products')" class="flex flex-col items-center rounded-lg border-2 border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-gray-700">
                                    <svg class="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                    </svg>
                                    <span class="mt-2 text-xs font-medium text-gray-900 dark:text-white">Buscar</span>
                                </button>
    
                                <button @click="navigateTo('/inventory')" class="flex flex-col items-center rounded-lg border-2 border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-gray-700">
                                    <svg class="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                                    </svg>
                                    <span class="mt-2 text-xs font-medium text-gray-900 dark:text-white">Stock</span>
                                </button>
    
                                <button class="flex flex-col items-center rounded-lg border-2 border-gray-200 p-4 opacity-50 cursor-not-allowed dark:border-gray-700">
                                    <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                    </svg>
                                    <span class="mt-2 text-xs font-medium text-gray-400">POS</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
`;
    fs.writeFileSync(file, content.substring(0, startIndex) + newContent + content.substring(endIndex));
    console.log('Replaced successfully!');
} else {
    console.log('Markers not found!');
}
