const Usuario = require("./models/usuario");

const resolvers = {
    Query: {
        getUsuarios: async () => {
            return await Usuario.find();
        },
        getUsuariosById: async (_, { id }) => {
            return await Usuario.findById(id);
        }
    },
    Mutation: {
        addUsuario: async (_, { input }) => {
            const nuevoUsuario = new Usuario(input);
            return await nuevoUsuario.save();
        },
        updUsuario: async (_, { id, input }) => {
            return await Usuario.findByIdAndUpdate(id, input, { new: true });
        },
        delUsuario: async (_, { id }) => {
            await Usuario.findByIdAndDelete(id);
            return { message: "Usuario eliminado correctamente" };
        }
    }
};

module.exports = resolvers;
