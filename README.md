# CSC309-A2

## users
/users, POST \
/users, GET \
/users/:userId, GET \
/users/:userId, PATCH \
/users/me, PATCH \
/users/me, GET \
/users/me/password, PATCH

## auth
/auth/tokens, POST \
/auth/resets, POST \
/auth/resets/:resetToken, POST

## transactions
/transactions, POST \
/transactions, GET \
/transactions/:transactionId, GET \
/transactions/:transactionId/suspicious, PATCH \
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
