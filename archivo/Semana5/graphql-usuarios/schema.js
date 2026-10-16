const { gql } = require("apollo-server-express");

const typeDefs = gql`
    type Usuario {
        id: ID
        nombre: String
        pass: String
    }

    input UsuarioInput {
        nombre: String
        pass: String
    }

    type Alert {
        message: String
    }

    type Query {
        getUsuarios: [Usuario]
        getUsuariosById(id: ID!): Usuario
    }

    type Mutation {
        addUsuario(input: UsuarioInput): Usuario
        updUsuario(id: ID!, input: UsuarioInput): Usuario
        delUsuario(id: ID!): Alert
    }
`;

module.exports = typeDefs;
