# CSC309-A2

## users
/users, POST jaycee \
/users, GET jaycee \
/users/:userId, GET jaycee \
/users/:userId, PATCH jaycee \
/users/me, PATCH jaycee \
/users/me, GET jaycee \
/users/me/password, PATCH jaycee

## auth
/auth/tokens, POST jaycee \
/auth/resets, POST jaycee \
/auth/resets/:resetToken, POST jaycee

## transactions
/transactions, POST jaycee \
/transactions, GET jaycee \
/transactions/:transactionId, GET jaycee \
/transactions/:transactionId/suspicious, PATCH jaycee \
/users/:userId/transactions, POST christina \
/users/me/transactions, POST christina \
/users/me/transactions, GET christina \
/transactions/:transactionId/processed, PATCH christina

## events
/events, POST kristen \
/events, GET kristen \
/events/:eventId, GET kristen \
/events/:eventId, PATCH kristen \
/events/:eventId, DELETE kristen \
/event/:eventId/organizers, POST Lavender \
/event/:eventId/organizers/:userId, DELETE Lavender \
/events/:eventId/guests, POST Lavender \
/events/:eventId/guests/:userId, DELETE Lavender\
/events/:eventId/guests/me, POST Lavender \
/events/:eventId/guests/me, DELETE Lavender \
/events/:eventId/transactions, POST christina

## promotions
/promotions, POST kristen \
/promotions, GET kristen \
/promotions/:promotionId, GET kristen \
/promotions/:promotionId, PATCH kristen \
/promotions/:promotionId, DELETE kristen
