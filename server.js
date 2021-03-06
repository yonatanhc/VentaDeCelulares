const express = require("express");
const path = require("path");
const exphbs = require('express-handlebars');
const socketio = require("socket.io");
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');

const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const dbURL = "mongodb://localhost:27017";
const dbConfig = { useNewUrlParser: true, useUnifiedTopology: true};
const dbName = "archivos";

app.use(session({
    secret: '2C44-4D44-WppQ38S',
    resave: true,
    saveUninitialized: true
}));

// Parser para interpretar datos  en el body de un request
app.use(bodyParser.urlencoded({ extended: true }));

// Path de base de recursos estáticos (archivos linkeados en htmls)
app.use(express.static(path.join(__dirname, '/public')));

app.engine('handlebars', exphbs({
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layout')
}));
app.set('view engine', 'handlebars')
app.set('views', path.join(__dirname, 'views'));

app.get("/",(req,res)=>{
    res.render('home');
});

app.post('/registrar', (req, res) => {
    MongoClient.connect(dbURL, dbConfig, (err, client) => {
        if (!err) {
        const colUsuarios = client.db(dbName).collection("usuarios");
        colUsuarios.insertOne({ 
            usuario: req.body.usuario, 
            nombre: req.body.nombre,
            correo:req.body.correo ,
            telefono:req.body.telefono,
            dni:req.body.dni,
            contraseña:req.body.contraseña
            },
            (err, result) => {
                if (!err && result) {
                    res.sendFile(path.join(__dirname,'public/html/login.html')); 
                }        
        });

        } else {
            console.log("error");
        }
    });
});



app.get("/carrito",(req,res)=>{
    if (req.session.usuario !== undefined) {
        req.session.carrito.push({
            modelo:req.query.modelo,
            precio:req.query.precio,
            imagen:req.query.imagen
        });
        req.session.total = req.session.total + Number(req.query.precio);
        res.render('perfil',{
            usuario : req.session.usuario,
            carrito: req.session.carrito,
            total : req.session.total
        });
    } else {
        res.sendFile(path.join(__dirname,'public/html/login.html')); 
    }
});

app.get("/eliminar",(req,res)=>{
    for (let i = 0; i < req.session.carrito.length; i++) {
        var element = req.session.carrito[i];
        if(element.modelo == req.query.modelo){
            req.session.carrito.splice(i,1);
        } 
    }
    req.session.total -= req.query.precio;
    res.render('perfil',{
        usuario : req.session.usuario,
        carrito: req.session.carrito,
        total : req.session.total
    });
});

app.get("/iniciarSesion",(req,res)=>{
    if (req.session.usuario !== undefined) {
        res.render('perfil',{
            usuario : req.session.usuario,
            carrito: req.session.carrito,
            total: req.session.total
        });
    } else {
        res.sendFile(path.join(__dirname,'public/html/login.html')); 
    }
});

app.get("/homeTelefono",(req,res)=>{
    MongoClient.connect(dbURL, dbConfig, (err, client) => {
        if (!err) {
            const archivo = client.db(dbName);
            const colTelefonos = archivo.collection("telefonos");
            colTelefonos.findOne({modelo: req.query.modelo},(err, telefono) => {
                client.close();
                if (!err) {
                    res.render('homeTelefono',{
                        telefono:telefono,
                        usuario: req.session.usuario
                    });
                    if(req.session.usuario != undefined){
                        conectarComentarios(telefono);
                    }
                }
                else{
                    console.log("error al abrir la colleccion");
                }
            });
        }
        else{
            console.log("error al abrir el archivo");
        }
    });
    
});

app.get("/salir",(req,res)=>{
    req.session.destroy();
    res.render('home');
});

app.get("/registrarse",(req,res)=>{
    res.sendFile(path.join(__dirname,'public/html/crearCuenta.html'));
});


app.post('/login',(req,res)=>{
    if(req.body.user && req.body.password){
        validarUser(req.body.user,req.body.password,resultado =>{
            if(resultado){
                req.session.usuario = resultado;
                req.session.carrito = [];
                req.session.total = 0;
                res.render('perfil',{
                    usuario : req.session.usuario,
                    carrito: req.session.carrito,
                    total : req.session.total
                })
            }
            else{
                req.session.destroy();
                res.sendFile(path.join(__dirname,'public/html/login.html'));
            }
        });
    }
    else{
        res.sendFile(path.join(__dirname,'public/html/login.html'));
    }
});


app.get("/buscar",(req,res)=>{
    
    MongoClient.connect(dbURL, dbConfig, (err, client) => {
    if (!err) {

        const archivo = client.db(dbName);

        const colTelefonos = archivo.collection("telefonos");
        
        colTelefonos.find({ marca: req.query.buscar }).toArray((err, telefonos) => {
            client.close();
            if (!err) {
                res.render('telefono', {
                    listaTelefonos: telefonos
                });
            } else {
                console.log("No se pudo consultar la colección de telefonos: " + err);
            }
        });

    } else {
        console.log("ERROR AL CONECTAR: " + err);
    }
    });
});

const server = app.listen(3000,()=>{
    console.log("corriendo en el puerto 3000...");
});

function validarUser(usr, pwd, callback) {
    MongoClient.connect(dbURL, dbConfig, (err, client) => {
        if(!err) {
            const colUsuarios = client.db(dbName).collection("usuarios");
            colUsuarios.findOne({ usuario: usr, contraseña: pwd }, (err, resConsulta) => {
                client.close();
                if (!err) {
                    callback(resConsulta);
                }
            });
        }
    });
}

function conectarComentarios(telefono){
    const io = socketio(server);
    io.on('connection',(socket)=>{
        console.log("conectado");
        socket.join(telefono._id);
        console.log(telefono._id);
        socket.on("mi-mensaje",(dato)=>{
            io.to(telefono._id).emit("mensaje-servidor",dato);
        });
    });

}
    