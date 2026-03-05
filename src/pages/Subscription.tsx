import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function Subscription() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { verifyPayment, refreshSubscription } = useSubscription();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  // Flutterwave returns different param names depending on payment method
  // For cards: status=successful, transaction_id=XXX
  // For bank transfer: status=successful, tx_ref=XXX, tx_id=XXX  
  const paymentStatus = searchParams.get("status");
  const transactionId = searchParams.get("transaction_id") || searchParams.get("tx_id");
  const txRef = searchParams.get("tx_ref");

  // Debug: log all params
  useEffect(() => {
    console.log("Subscription callback params:", {
      paymentStatus,
      transactionId,
      txRef,
      allParams: Object.fromEntries(searchParams.entries())
    });
  }, [paymentStatus, transactionId, txRef, searchParams]);

  useEffect(() => {
    const handleCallback = async () => {
      if (!user) {
        setStatus("error");
        setMessage("Please sign in to verify your subscription.");
        return;
      }

      // Flutterwave returns "successful" for successful payments, "completed" for some methods
      const isSuccessStatus = paymentStatus === "successful" || paymentStatus === "success" || paymentStatus === "completed";
      const txId = transactionId || txRef;

      if (isSuccessStatus && txId) {
        try {
          setMessage("Verifying your payment...");
          const verified = await verifyPayment(txId);
          if (verified) {
            await refreshSubscription();
            setStatus("success");
            setMessage("Your premium subscription is now active! Enjoy unlimited access.");
          } else {
            setStatus("error");
            setMessage("Payment verification failed. Please contact support if you were charged.");
          }
        } catch (err) {
          console.error("Verification error:", err);
          setStatus("error");
          setMessage("An error occurred during verification. Please try again.");
        }
      } else if (paymentStatus === "cancelled" || paymentStatus === "failed") {
        setStatus("error");
        setMessage("Payment was cancelled or failed. You can try again anytime.");
      } else if (!paymentStatus && !txId) {
        // No params - just visiting the page directly
        setStatus("error");
        setMessage("No payment to verify. Please start a new subscription from your profile.");
      } else {
        // We have some params but couldn't process
        setStatus("error");
        setMessage(`Payment callback incomplete. Status: ${paymentStatus || 'unknown'}, ID: ${txId || 'none'}. Please contact support.`);
      }
    };

    handleCallback();
  }, [user, paymentStatus, transactionId, txRef, verifyPayment, refreshSubscription]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex flex-col items-center gap-4">
            {status === "loading" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <span>Verifying Payment...</span>
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle className="h-12 w-12 text-green-500" />
                <span>Payment Successful!</span>
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="h-12 w-12 text-destructive" />
                <span>Payment Issue</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{message}</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/profile")}>
              Go to Profile
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
