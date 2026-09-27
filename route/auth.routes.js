import { Router } from 'express';
import { register } from '../controllers/admin.emp.controllers.js';


const routerAuth = Router();

routerAuth.post('/register', register);

export default routerAuth;


