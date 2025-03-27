import { NextApiRequest, NextApiResponse } from 'next';
import { proxyPostRequest } from '../../utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    return proxyPostRequest(req, res, '/v1/chat/completions');
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
