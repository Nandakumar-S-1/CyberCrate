const Order=require('../../Models/orderModel');
const User=require('../../Models/userModel');
const Wallet=require('../../Models/walletModel');

const loadWallet=async(req,res)=>{
    try {
        
        const userId=req.session.user._id;
        const user=await User.findById(userId);
        const wallet=await Wallet.findOne({userId:userId});

        res.render('users/wallet',{user,wallet});
    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

const addMoneyToWallet=async(req,res)=>{
    try {
        
        const {userId,paymentMethod,amount}=req.body;
        if(!userId || !paymentMethod || !amount){
            return res.status(400).json({ message: 'Missing required fields' });
        }
        let wallet=await Wallet.findOne({userId:userId});
        if(!wallet){
            wallet=new Wallet({userId:userId,amount:0});
            await wallet.save();
        }
        
        wallet.transactions.push({
            trsactionId:Date.now(),
            paymentMethod:paymentMethod,
            amount:amount
        });
        wallet.amount+=amount;
        await wallet.save();
        res.status(200).json({ message: 'Amount added to wallet successfully' });

    } catch (error) {
        console.log('error while adding money to wallet',error);
        res.status(500).json({ message: 'Internal Server Error' });
        
    }
}

const refundToWallet=async(req,res)=>{
    try {
        const {userId,amount,refundId,orderId}=req.body;
        if(!userId || !amount || !refundId || !orderId){
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const wallet=await Wallet.findOne({userId:userId});
        if(!wallet){
            return res.status(404).json({ message: 'Wallet not found' });
        }

        wallet.refundHistory.push({
            refundId:refundId,
            orderId:orderId,
            amount:amount
        });
        wallet.amount+=amount;
        await wallet.save();
        res.status(200).json({ message: 'Refund added to wallet successfully' });

    } catch (error) {
        
    }
}


module.exports={
    loadWallet,
    addMoneyToWallet,
    refundToWallet
};