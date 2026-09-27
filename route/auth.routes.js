import { Router } from 'express';
import { register, login } from '../controllers/admin.emp.controllers.js';


const routerAuth = Router();

routerAuth.post('/register', register);
routerAuth.post('/login', login);

export default routerAuth;


