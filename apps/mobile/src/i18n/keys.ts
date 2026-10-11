/**
 * Translation keys contract.
 * Every user-facing string must have a corresponding key here.
 * Missing keys in Arabic or English produce compile-time TypeScript errors.
 */

export interface TranslationDictionary {
  // Navigation Tabs
  "tab.home": string;
  "tab.search": string;
  "tab.favorites": string;
  "tab.account": string;
  "tab.cart": string;

  // Header & Brand
  "header.location": string;
  "header.greeting": string;
  "header.cartBadge": string;
  "header.searchPlaceholder": string;
  "header.switchLanguage": string;

  // Home Sections
  "home.categoriesTitle": string;
  "home.dealsTitle": string;
  "home.freshPicksTitle": string;
  "home.seeAll": string;
  "home.specialOffers": string;
  "home.devBanner": string;

  // Search & Filters
  "search.title": string;
  "search.resultsCount": string;
  "search.noResults": string;
  "search.noResultsDesc": string;
  "search.clear": string;
  "search.recentSearches": string;
  "search.popular": string;
  "filter.all": string;
  "filter.deals": string;
  "filter.organic": string;
  "filter.inStock": string;

  // Product & Commerce
  "product.unit": string;
  "product.addToCart": string;
  "product.addedToCart": string;
  "product.inStock": string;
  "product.lowStock": string;
  "product.outOfStock": string;
  "product.discountBadge": string;
  "product.description": string;
  "product.origin": string;
  "product.nutrition": string;
  "product.selectVariant": string;

  // Cart
  "cart.title": string;
  "cart.emptyTitle": string;
  "cart.emptyDesc": string;
  "cart.startShopping": string;
  "cart.subtotal": string;
  "cart.discount": string;
  "cart.deliveryFee": string;
  "cart.freeDeliveryThreshold": string;
  "cart.freeDeliveryUnlocked": string;
  "cart.taxEstimate": string;
  "cart.total": string;
  "cart.checkoutButton": string;
  "cart.checkoutPrototypeNotice": string;
  "cart.applyCoupon": string;
  "cart.couponPlaceholder": string;
  "cart.couponApplied": string;
  "cart.couponInvalid": string;
  "cart.itemsCount": string;
  "cart.clearAll": string;

  // Sticky Cart Bar
  "cartBar.viewCart": string;
  "cartBar.items": string;

  // Favorites
  "favorites.title": string;
  "favorites.emptyTitle": string;
  "favorites.emptyDesc": string;
  "favorites.addAllToCart": string;

  // Account & Profile
  "account.title": string;
  "account.guestUser": string;
  "account.signInNotice": string;
  "account.languageSection": string;
  "account.currentLanguage": string;
  "account.themeSection": string;
  "account.lightMode": string;
  "account.darkMode": string;
  "account.deliveryAddresses": string;
  "account.ordersHistory": string;
  "account.support": string;
  "account.version": string;
  "account.prototypeBadge": string;

  // Authentication
  "auth.signInTitle": string;
  "auth.signInSubtitle": string;
  "auth.signUpTitle": string;
  "auth.signUpSubtitle": string;
  "auth.verifyTitle": string;
  "auth.verifySubtitle": string;
  "auth.emailLabel": string;
  "auth.emailPlaceholder": string;
  "auth.passwordLabel": string;
  "auth.passwordPlaceholder": string;
  "auth.confirmPasswordLabel": string;
  "auth.confirmPasswordPlaceholder": string;
  "auth.firstNameLabel": string;
  "auth.firstNamePlaceholder": string;
  "auth.lastNameLabel": string;
  "auth.lastNamePlaceholder": string;
  "auth.verificationCodeLabel": string;
  "auth.verificationCodePlaceholder": string;
  "auth.signInButton": string;
  "auth.signUpButton": string;
  "auth.verifyButton": string;
  "auth.resendCodeButton": string;
  "auth.signOutButton": string;
  "auth.signingIn": string;
  "auth.signingUp": string;
  "auth.verifying": string;
  "auth.signingOut": string;
  "auth.dontHaveAccount": string;
  "auth.alreadyHaveAccount": string;
  "auth.createAccountLink": string;
  "auth.signInLink": string;
  "auth.errorEmailRequired": string;
  "auth.errorPasswordRequired": string;
  "auth.errorPasswordLength": string;
  "auth.errorPasswordMismatch": string;
  "auth.errorCodeRequired": string;
  "auth.errorGeneric": string;
  "auth.errorInvalidCredentials": string;
  "auth.errorUserExists": string;
  "auth.errorInvalidCode": string;
  "auth.clerkNotConfigured": string;
  "auth.clerkConfigInstructions": string;
  "auth.signedInAs": string;
  "auth.roleCustomer": string;
  "auth.roleAdmin": string;
  "auth.errorTitle": string;
  "auth.errorSupportHint": string;
  "auth.sessionEndedTitle": string;
  "auth.sessionEndedDesc": string;
  "auth.errorSignOut": string;

  // Data source
  "data.sampleDataTitle": string;
  "data.sampleDataBody": string;

  // Common Actions & States
  "action.retry": string;
  "action.close": string;
  "action.save": string;
  "action.back": string;
  "action.share": string;
  "state.loading": string;
  "state.error": string;
  "state.empty": string;
}

export type TranslationKey = keyof TranslationDictionary;
