<script setup lang="ts">
import { useThemeStore } from './stores/theme';
import NavBar from './components/NavBar.vue';
import FooterBar from './components/FooterBar.vue';

useThemeStore().apply();
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <NavBar />
    <main class="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
      <RouterView />
    </main>
    <FooterBar />
  </div>
</template>
