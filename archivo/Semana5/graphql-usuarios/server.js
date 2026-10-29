const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { ApolloServer } = require("apollo-server-express");

const typeDefs = require("./schema");
const resolvers = require("./resolvers");

async function iniciarServidor() {
    const app = express();
    app.use(cors());

    mongoose.connect("mongodb://localhost:27017/graphql_usuarios")
        .then(() => console.log("MongoDB conectado"))
        .catch((err) => console.log(err));

    const server = new ApolloServer({ typeDefs, resolvers });
    await server.start();
    server.applyMiddleware({ app });

    app.listen({ port: 4000 }, () =>
        console.log(`Graphql Iniciado en http://localhost:4000${server.graphqlPath}`)
    );
}

iniciarServidor();
