<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FoodShareController;
use App\Http\Controllers\Api\SupportController;
use App\Http\Controllers\Api\CustomRecipeController;
use App\Http\Controllers\Api\FamilyController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReceiptController;
use App\Http\Controllers\Api\RecipeController;
use App\Http\Controllers\Api\ShoppingListController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\StorageZoneController;
use Illuminate\Support\Facades\Route;

Route::post('admin/set-premium', [AdminController::class, 'setPremium']);

Route::prefix('auth')->group(function () {
    Route::post('register',        [AuthController::class, 'register']);
    Route::post('login',           [AuthController::class, 'login']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password',  [AuthController::class, 'resetPassword']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me',      [AuthController::class, 'me']);

    Route::get('family',                    [FamilyController::class, 'show']);
    Route::put('family',                    [FamilyController::class, 'update']);
    Route::post('family/join',              [FamilyController::class, 'join']);
    Route::post('family/regenerate-code',   [FamilyController::class, 'regenerateCode']);
    Route::delete('family/members/{user}',  [FamilyController::class, 'removeMember']);

    Route::apiResource('storage-zones', StorageZoneController::class);

    Route::get('products/by-barcode/{barcode}',      [ProductController::class, 'findByBarcode']);
    Route::get('products',                          [ProductController::class, 'index']);
    Route::post('products',                         [ProductController::class, 'store']);
    Route::put('products/{product}',                [ProductController::class, 'update']);
    Route::delete('products/{product}',             [ProductController::class, 'destroy']);
    Route::post('products/{product}/open',          [ProductController::class, 'markOpened']);
    Route::post('products/{product}/consume',       [ProductController::class, 'markConsumed']);
    Route::post('products/{product}/waste',         [ProductController::class, 'markWasted']);

    Route::get('stats', [StatsController::class, 'index']);

    Route::post('receipts/scan',    [ReceiptController::class, 'scan']);
    Route::post('receipts/confirm', [ReceiptController::class, 'confirm']);

    Route::get('recipes/suggest',        [RecipeController::class, 'suggest']);
    Route::get('recipes/custom',         [CustomRecipeController::class, 'index']);
    Route::post('recipes/custom',        [CustomRecipeController::class, 'store']);
    Route::get('recipes/custom/{id}',    [CustomRecipeController::class, 'show']);
    Route::put('recipes/custom/{id}',    [CustomRecipeController::class, 'update']);
    Route::delete('recipes/custom/{id}', [CustomRecipeController::class, 'destroy']);
    Route::get('recipes/{id}',           [RecipeController::class, 'show']);

    Route::delete('shopping-list/clear-bought',       [ShoppingListController::class, 'clearBought']);
    Route::post('shopping-list/move-to-fridge',       [ShoppingListController::class, 'moveToFridge']);
    Route::get('shopping-list',                        [ShoppingListController::class, 'index']);
    Route::post('shopping-list',                       [ShoppingListController::class, 'store']);
    Route::put('shopping-list/{item}',                 [ShoppingListController::class, 'update']);
    Route::delete('shopping-list/{item}',              [ShoppingListController::class, 'destroy']);

    Route::get('support',                        [SupportController::class, 'index']);
    Route::post('support',                       [SupportController::class, 'store']);
    Route::post('support/{message}/reply',       [SupportController::class, 'reply']);
    Route::post('support/{message}/close',       [SupportController::class, 'close']);

    Route::get('food-sharing/my',                           [FoodShareController::class, 'my']);
    Route::get('food-sharing',                              [FoodShareController::class, 'index']);
    Route::post('food-sharing',                             [FoodShareController::class, 'store']);
    Route::get('food-sharing/{foodShare}',                  [FoodShareController::class, 'show']);
    Route::post('food-sharing/{foodShare}/reserve',         [FoodShareController::class, 'reserve']);
    Route::post('food-sharing/{foodShare}/cancel-reserve',  [FoodShareController::class, 'cancelReserve']);
    Route::post('food-sharing/{foodShare}/give',            [FoodShareController::class, 'give']);
    Route::delete('food-sharing/{foodShare}',               [FoodShareController::class, 'cancel']);
    Route::delete('food-sharing/{foodShare}/purge',         [FoodShareController::class, 'purge']);
    Route::post('food-sharing/{foodShare}/messages',        [FoodShareController::class, 'sendMessage']);
});
