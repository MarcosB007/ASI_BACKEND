import { Router } from 'express';
import { register } from '../controllers/auth.controllers.js';


const routerAuth = Router();

routerAuth.post('/register', register);

export default routerAuth;


