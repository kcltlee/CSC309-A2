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
/users/:userId/transactions, POST christina? \
/users/me/transactions, POST christina? \
/users/me/transactions, GET christina? \
/transactions/:transactionId/processed, PATCH christina?

## events
/events, POST kristen \
/events, GET kristen \
/events/:eventId, GET kristen \
/events/:eventId, PATCH kristen \
/events/:eventId, DELETE kristen \
/event/:eventId/organizers, POST \
/event/:eventId/organizers/:userId, DELETE \
/events/:eventId/guests, POST \
/events/:eventId/guests/:userId, DELETE \
/events/:eventId/guests/me, POST \
/events/:eventId/guests/me, DELETE \
/events/:eventId/transactions, POST christina?

## promotions
/promotions, POST kristen \
/promotions, GET kristen \
/promotions/:promotionId, GET kristen \
/promotions/:promotionId, PATCH kristen \
/promotions/:promotionId, DELETE kristen
