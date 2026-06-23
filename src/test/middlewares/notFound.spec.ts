import { notFound } from '../../middlewares/notFound';

const buildRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('middlewares/notFound', () => {
  it('responde 404 con mensaje "Ruta no encontrada"', () => {
    const res = buildRes();
    notFound({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Ruta no encontrada' });
  });
});
