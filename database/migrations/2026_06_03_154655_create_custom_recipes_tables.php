<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('custom_recipes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('instructions')->nullable();
            $table->unsignedSmallInteger('servings')->nullable();
            $table->unsignedSmallInteger('ready_in_minutes')->nullable();
            $table->string('image_url')->nullable();
            $table->timestamps();
        });

        Schema::create('custom_recipe_ingredients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recipe_id')->constrained('custom_recipes')->cascadeOnDelete();
            $table->string('name');
            $table->decimal('amount', 8, 2)->nullable();
            $table->string('unit', 50)->nullable();
            $table->tinyInteger('sort_order')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('custom_recipe_ingredients');
        Schema::dropIfExists('custom_recipes');
    }
};
