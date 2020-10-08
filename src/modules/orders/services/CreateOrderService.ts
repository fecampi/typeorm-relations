import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // verifica se existe
    const customerExists = await this.customersRepository.findById(customer_id);
    // Se não existir
    if (!customerExists) {
      throw new AppError('could not find any customers with the given id');
    }
    // pegar os produtos que estou procurando[1,2,3,4,5,5]
    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    // se não tem nenhum item na lista
    if (!existentProducts.length) {
      throw new AppError('could not find any products with the given id');
    }

    const existentProductsIds = existentProducts.map(product => product.id);

    // Opa!! quais os que não existem
    const checkInexistentProducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find products ${checkInexistentProducts[0].id}`,
      );
    }

    // Desses, quais não tem quantidade
    const findProductsWithQuantityAvailable = products.filter(
      product =>
        existentProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    // se tiver alguma coisa dentro
    if (findProductsWithQuantityAvailable.length) {
      throw new AppError(
        `the quantity${findProductsWithQuantityAvailable[0]} is not available for ${findProductsWithQuantityAvailable[0].id}`,
      );
    }

    // pegar cada retornando um objeto
    const serializedProduct = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProduct,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existentProducts.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);
    return order;
  }
}

export default CreateOrderService;
