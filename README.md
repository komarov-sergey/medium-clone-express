run mongo:

- brew services start mongodb-community@4.2
- brew services stop mongodb-community@4.2
- mongod --config /usr/local/etc/mongod.conf --fork
