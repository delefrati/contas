<template>
  <div class="container">
    <div class="content">
      <section class="expenses-section not-found">
        <p class="not-found-code">404</p>
        <h2>{{ $t('notFound.title') }}</h2>
        <p>{{ $t('notFound.text') }}</p>
        <div class="not-found-actions">
          <router-link to="/" class="btn-primary">
            <i class="fa-solid fa-house"></i> {{ $t('notFound.home') }}
          </router-link>
          <router-link to="/ajuda" class="btn-secondary">
            <i class="fa-solid fa-circle-question"></i> {{ $t('notFound.help') }}
          </router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  text-align: center;
}
.not-found-code {
  margin: 0;
  font-size: 3rem;
  font-weight: 700;
  color: var(--text-light);
}
.not-found-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
}
.not-found-actions a {
  text-decoration: none;
}
</style>
