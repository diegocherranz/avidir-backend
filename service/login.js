const AWS = require('aws-sdk');
AWS.config.update({
    region: 'eu-west-3'
});

const util = require('../utils/util');
const bcrypt = require('bcryptjs');
const auth = require('../utils/auth');


const dynamodb = new AWS.DynamoDB.DocumentClient();
const userTable = 'UsersAvidir';

async function login(user){
    const email = user.email;
    const password = user.password;
    if (!user || !email || !password){
        return util.buildResponse(401, {
            message: 'Email y Contraseña obligatorios'
        })
    }

    const dynamoUser = await getUser(email);
    if(!dynamoUser || !dynamoUser.email){
        return util.buildResponse(403, {
            message: 'El usuario no existe.'
        });
    }

    if(!bcrypt.compareSync(password, dynamoUser.password)){
        return util.buildResponse(403, {message: "Contraseña o usuario incorrectos"});
    }

    const userInfo = {
        uuid: dynamoUser.uuid,
        email: dynamoUser.email,
        nombre: dynamoUser.nombre,
        apellido: dynamoUser.apellido,
        fecha_nacimiento: dynamoUser.fecha_nacimiento,
        tipo: dynamoUser.tipo
    }

    const token = auth.generateToken(userInfo);
    const response = {
        user: userInfo,
        token: token
    }
    return util.buildResponse(200, response);
}

async function getUser(email){
    /*
    const params = {
        TableName: userTable,
        Key:{
            email: email
        }
    }*/

    const params = {
        ExpressionAttributeValues: {
          ':emailToLook' :  email
        },
        FilterExpression: 'email = :emailToLook',
        TableName: userTable
      };

    return await dynamodb.scan(params).promise().then(response => {
        return response.Items[0];
    }, error => {
        console.error("Error al obtener usuario: ", error);
    })
}

module.exports.login = login;