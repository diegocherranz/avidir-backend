const AWS = require('aws-sdk');
AWS.config.update({
    region: 'eu-west-3'
});

const util = require('../utils/util')
const bcrypt = require('bcryptjs')
const {v4: uuidv4 } = require('uuid')

const dynamodb = new AWS.DynamoDB.DocumentClient();
const userTable = 'UsersAvidir';

async function register(userInfo) {
    const uuid = uuidv4();
    const nombre = userInfo.nombre;
    const apellido = userInfo.apellido;
    const email = userInfo.email;
    const password = userInfo.password;
    const dni = userInfo.dni;
    const fecha_nacimiento = userInfo.fecha_nacimiento;

    if (!nombre || !apellido || !email || !password || !dni || !fecha_nacimiento) {
        return util.buildResponse(401, {
            message: "Todos los campos son obligatorios."
        })
    }

    const dynamoUsers = await getUser(email);
    if (dynamoUsers && dynamoUsers.length > 0 ) {
        return util.buildResponse(401, {
            message: "Este usuario ya existe en la base de datos"
        })

        
    }

    const encryptedPW = bcrypt.hashSync(password.trim(), 10);
        const user = {
            uuid: uuid,
            nombre: nombre,
            apellido: apellido,
            email: email,
            tipo: "C",
            password: encryptedPW,
            dni: dni,
            fecha_nacimiento: fecha_nacimiento
        }

        const saveUserResponse = await saveUser(user);
        if (!saveUserResponse) {
            return util.buildResponse(503, { message: "Server Error. Inténtalo de nuevo más tarde" });
        }
        return util.buildResponse(200, { email: email });


}

async function getUser(email) {
    /*
    const params = {
        TableName: userTable,
        Key: {
            email: email
        }
    }
    */

    const params = {
        ExpressionAttributeValues: {
          ':emailToLook' :  email
        },
        FilterExpression: 'email = :emailToLook',
        TableName: userTable
      };

    return await dynamodb.scan(params).promise().then(response => {
        return response.Items;
    }, error => {
        console.error("Error al obtener usuario: ", error);
    })
}

async function saveUser(user) {
    const params = {
        TableName: userTable,
        Item: user
    }
    return await dynamodb.put(params).promise().then(() => {
        return true;
    }, error => {
        console.error('Hubo un error al registrar el usuario: ', error)
    });
}

module.exports.register = register;