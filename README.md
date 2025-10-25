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
/users/:userId/transactions, POST \
/users/me/transactions, POST \
/users/me/transactions, GET \
/transactions/:transactionId/processed, PATCH

## events
/events, POST \
/events, GET \
/events/:eventId, GET \
/events/:eventId, PATCH \
/events/:eventId, DELETE \
/event/:eventId/organizers, POST \
/event/:eventId/organizers/:userId, DELETE \
/events/:eventId/guests, POST \
/events/:eventId/guests/:userId, DELETE \
/events/:eventId/guests/me, POST \
/events/:eventId/guests/me, DELETE \
/events/:eventId/transactions, POST

## promotions
/promotions, POST \
/promotions, GET \
/promotions/:promotionId, GET \
/promotions/:promotionId, PATCH \
/promotions/:promotionId, DELETE
